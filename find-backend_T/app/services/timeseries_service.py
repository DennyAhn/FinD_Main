# app/services/timeseries_service.py
import httpx
import json
from datetime import datetime, timedelta
from typing import Dict, Any, List

from sqlalchemy.orm import Session
from app.config import FMP_API_KEY, FMP_BASE_URL
from app import models
from app.mcp.decorators import register_tool

@register_tool
async def fetch_market_time_series(
    ticker: str,
    db: Session,
    client: httpx.AsyncClient,
    period: str = "1M",  # 실제로는 분석을 위해 2달치 데이터를 가져와서 계산합니다.
) -> Dict[str, Any]:
    """
    [주가 변동 원인 분석용 핵심 도구]
    특정 종목(ticker)의 최근 주가 흐름과 변동폭을 계산하여 반환합니다.
    
    기능:
    1. FMP Historical Price API 호출 (최근 60일 데이터)
    2. 데이터 캐싱 (1시간)
    3. '오늘 vs 1주 전', '오늘 vs 1달 전' 수익률 자동 계산
    
    Args:
        ticker (str): 주식 티커 (예: NVDA, AAPL)
        period (str): (사용되지 않음, 내부적으로 충분한 기간 확보)
        
    Returns:
        Dict: 분석된 주가 데이터 및 요약 텍스트
    """
    # 1. 캐시 키 생성 (ticker 기준, 1시간 유효)
    cache_key = f"fmp_historical_analysis_v1:{ticker}"
    now = datetime.now()
    
    # 2. 캐시 조회
    cached_data = db.query(models.ApiCache).filter(
        models.ApiCache.cache_key == cache_key,
        models.ApiCache.expires_at > now
    ).first()

    history_data = []

    if cached_data:
        print(f"[Cache HIT] 주가 데이터 분석 캐시 사용: {ticker}")
        history_data = cached_data.data  # JSON으로 저장된 리스트
    else:
        print(f"[Cache MISS] FMP API 호출: /historical-price-full/{ticker} (60일)")
        # 최근 60일(약 2달) 데이터 요청 -> 1주/1달 변동폭 계산에 충분
        url = f"{FMP_BASE_URL}/historical-price-full/{ticker}?timeseries=70&apikey={FMP_API_KEY}"
        
        try:
            response = await client.get(url)
            response.raise_for_status()
            data = response.json()
            
            # FMP 응답 구조: {"symbol": "NVDA", "historical": [...]}
            history_data = data.get("historical", [])
            
            if not history_data:
                return {"error": f"데이터를 찾을 수 없습니다: {ticker}"}

            # 캐시 저장 (1시간 = 60분)
            expires_at = now + timedelta(minutes=60)
            
            # 기존 캐시가 있으면 업데이트, 없으면 생성 (upsert 로직)
            existing_cache = db.query(models.ApiCache).filter(models.ApiCache.cache_key == cache_key).first()
            if existing_cache:
                existing_cache.data = history_data
                existing_cache.expires_at = expires_at
            else:
                new_cache = models.ApiCache(
                    cache_key=cache_key,
                    data=history_data,
                    expires_at=expires_at
                )
                db.add(new_cache)
            
            db.commit()
            
        except Exception as e:
            print(f"FMP API 호출 실패: {e}")
            return {"error": "주가 데이터를 가져오는 중 오류가 발생했습니다."}

    # --- 3. 데이터 분석 및 계산 (Backend-side Calculation) ---
    if not history_data:
        return {"error": "데이터가 비어있습니다."}

    # 데이터는 최신순(내림차순)으로 정렬되어 있다고 가정 (FMP 기본 동작)
    # index 0: 가장 최근 (오늘 또는 전일 종가)
    latest = history_data[0]
    latest_price = float(latest.get("close", 0))
    latest_date = latest.get("date")

    # [계산 1] 1주일 전 (약 5 거래일 전)
    week_idx = min(5, len(history_data) - 1)
    week_ago = history_data[week_idx]
    week_ago_price = float(week_ago.get("close", 0))
    week_ago_date = week_ago.get("date")
    
    week_diff = latest_price - week_ago_price
    week_pct = (week_diff / week_ago_price) * 100 if week_ago_price else 0

    # [계산 2] 1달 전 (약 20 거래일 전)
    month_idx = min(20, len(history_data) - 1)
    month_ago = history_data[month_idx]
    month_ago_price = float(month_ago.get("close", 0))
    month_ago_date = month_ago.get("date")

    month_diff = latest_price - month_ago_price
    month_pct = (month_diff / month_ago_price) * 100 if month_ago_price else 0
    
    # [방향성 텍스트 생성]
    def get_trend_text(pct):
        if pct > 0: return "상승"
        if pct < 0: return "하락"
        return "보합"

    # [트렌드 데이터 추출 - 최근 5일치]
    recent_trend = []
    for i in range(min(5, len(history_data))):
        d = history_data[i]
        recent_trend.append(f"{d['date']}: ${d['close']}")

    # --- 4. 최종 결과 반환 (AI가 읽기 쉬운 형태) ---
    return {
        "symbol": ticker,
        "reference_date": latest_date,
        "current_price": latest_price,
        "analysis": {
            "1_week": {
                "date": f"{week_ago_date} -> {latest_date}",
                "change_amount": round(week_diff, 2),
                "change_percent": round(week_pct, 2),
                "trend": get_trend_text(week_pct),
                "summary": f"1주 전({week_ago_date}) 대비 {round(week_pct, 1)}% {get_trend_text(week_pct)} (${week_ago_price} -> ${latest_price})"
            },
            "1_month": {
                "date": f"{month_ago_date} -> {latest_date}",
                "change_amount": round(month_diff, 2),
                "change_percent": round(month_pct, 2),
                "trend": get_trend_text(month_pct),
                "summary": f"1달 전({month_ago_date}) 대비 {round(month_pct, 1)}% {get_trend_text(month_pct)} (${month_ago_price} -> ${latest_price})"
            }
        },
        "recent_daily_trend": recent_trend, # 최근 5일치 데이터 (추세 파악용)
        "raw_data_summary": "Data fetched from FMP and calculated by backend."
    }
