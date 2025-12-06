"""기업 실적(Earnings) 관련 서비스 로직을 정의하는 모듈."""
# app/services/earnings_service.py
import httpx, json
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from typing import Dict, Any, Optional
from app.config import FMP_API_KEY
from app import models
from app.mcp.decorators import register_tool

FMP_BASE_URL = "https://financialmodelingprep.com/api/v3"

@register_tool
async def fetch_earnings_call_transcript(
    ticker: str,
    db: Session,
    client: httpx.AsyncClient,
    year: int = None,
    quarter: int = None
) -> Dict[str, Any]:
    """
    특정 티커(ticker)의 실적발표 컨퍼런스 콜 전문(Transcript)을 조회합니다.
    CEO와 임원진의 구체적인 발언, 질의응답 내용을 확인할 수 있어서 깊이 있는 분석에 필수적입니다.
    year, quarter를 생략하면 가장 최신의 분기 데이터를 가져옵니다.
    """
    # 1. 파라미터 구성
    if year and quarter:
        url = f"{FMP_BASE_URL}/earning_call_transcript/{ticker}?year={year}&quarter={quarter}&apikey={FMP_API_KEY}"
    else:
        # 최신순 조회 (리스트 반환)
        url = f"{FMP_BASE_URL}/earning_call_transcript/{ticker}?limit=1&apikey={FMP_API_KEY}"

    print(f"[Earnings Service] Transcript 요청: {ticker} (Year: {year}, Q: {quarter})")
    
    try:
        response = await client.get(url)
        response.raise_for_status()
        data = response.json()
        
        if not data:
            return {"error": "해당 기간의 Transcript를 찾을 수 없습니다."}

        # 리스트로 오는 경우 처리
        if isinstance(data, list):
            if not data:
                 return {"error": "Transcript 데이터가 비어있습니다."}
            transcript_data = data[0]
        else:
            transcript_data = data

        # 2. 결과 반환 (너무 길 수 있으므로 핵심 메타데이터와 내용은 앞부분 + 요약 요청용으로 전체 반환)
        # 주의: 전체 텍스트가 매우 길 수 있으므로, 프롬프트에서 잘라서 쓰거나 요약할 필요가 있음.
        # 여기서는 원본을 다 넘겨주고 LLM이 처리하도록 함 (Token limit 주의 필요하지만 gpt-4o-mini 등은 128k context라 괜찮음)
        
        return {
            "symbol": transcript_data.get("symbol"),
            "quarter": transcript_data.get("quarter"),
            "year": transcript_data.get("year"),
            "date": transcript_data.get("date"),
            "content": transcript_data.get("content") # 전체 텍스트
        }

    except Exception as e:
        print(f"fetch_earnings_call_transcript 에러: {e}")
        return {"error": f"Transcript 조회 실패: {str(e)}"}


@register_tool
async def fetch_earnings_calendar(
    ticker: str,
    db: Session,
    client: httpx.AsyncClient,
    limit: int = 5,
) -> list:
    """
    특정 티커(ticker)의 과거 실적 발표 기록과 EPS/매출 실적을 조회합니다.
    """
    cache_key = f"earnings_calendar_{ticker}"
    now = datetime.utcnow()

    cache_hit = (
        db.query(models.ApiCache)
        .filter(
            models.ApiCache.cache_key == cache_key,
            models.ApiCache.expires_at > now,
        )
        .first()
    )

    if not cache_hit:
        print(f"[{ticker}] Earnings Cache MISS -> FMP Fetching...")
        url = f"{FMP_BASE_URL}/historical/earning_calendar/{ticker}?limit={limit}&apikey={FMP_API_KEY}"
        try:
            response = await client.get(url)
            response.raise_for_status()
            data = response.json()
            print(f"[DEBUG] FMP API Response Count: {len(data)}")
            for item in data:
                eps_est = item.get("epsEstimated")
                eps_act = item.get("eps")
                rev_est = item.get("revenueEstimated")
                rev_act = item.get("revenue")

                def calc_surprise(actual, estimate):
                    if actual is not None and estimate and estimate != 0:
                        return ((actual - estimate) / abs(estimate)) * 100
                    return None

                db.merge(
                    models.EarningsCalendar(
                        ticker=item.get("symbol"),
                        date=item.get("date"),
                        period=item.get("fiscalDateEnding"),
                        market_time=item.get("time"),
                        
                        eps_estimate=eps_est,
                        eps_actual=eps_act,
                        eps_surprise_percent=calc_surprise(eps_act, eps_est),

                        revenue_estimate=rev_est,
                        revenue_actual=rev_act,
                        revenue_surprise_percent=calc_surprise(rev_act, rev_est),
                    )
                )

            db.merge(
                models.ApiCache(
                    cache_key=cache_key,
                    data={"refreshed_at": now.isoformat()},
                    expires_at=now + timedelta(hours=24),
                )
            )
            db.commit()
        except Exception as e:
            db.rollback()
            print(f"fetch_earnings_calendar 에러: {e}")

    final_earnings = (
        db.query(models.EarningsCalendar)
        .filter_by(ticker=ticker)
        .filter(models.EarningsCalendar.date <= datetime.now().date())
        .order_by(models.EarningsCalendar.date.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "date": str(e.date),
            "period": e.period,
            "time": e.market_time,
            "eps_estimate": e.eps_estimate,
            "eps_actual": e.eps_actual,
            "eps_surprise_percent": e.eps_surprise_percent,
            "revenue_estimate": e.revenue_estimate,
            "revenue_actual": e.revenue_actual,
            "revenue_surprise_percent": e.revenue_surprise_percent,
        }
        for e in final_earnings
    ]

@register_tool
async def fetch_earnings_surprises(
    ticker: str,
    db: Session,
    client: httpx.AsyncClient,
    limit: int = 5
) -> list:
    """
    특정 티커의 어닝 서프라이즈 내역을 조회합니다. 
    (fetch_earnings_calendar와 동일한 기능을 수행하는 Alias입니다)
    """
    return await fetch_earnings_calendar(ticker, db, client, limit)