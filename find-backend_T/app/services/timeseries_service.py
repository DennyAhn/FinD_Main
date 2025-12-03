# app/services/timeseries_service.py
import httpx, json
from sqlalchemy.orm import Session
from datetime import datetime
from app.config import TWELVE_DATA_API_KEY, TWELVE_DATA_BASE_URL
from app import models
from app.mcp.decorators import register_tool

# Twelve Data API가 지원하는 interval 형식
SUPPORTED_INTERVALS = {
    "1min": "1min",
    "5min": "5min",
    "15min": "15min",
    "30min": "30min",
    "45min": "45min",
    "1h": "1h",
    "2h": "2h",
    "4h": "4h",
    "1day": "1day",
    "1week": "1week",
    "1month": "1month",
    # 일반적인 변형들도 매핑
    "1d": "1day",
    "1w": "1week",
    "1m": "1month",
    "daily": "1day",
    "day": "1day",
}


def _normalize_interval(interval: str) -> str:
    """interval 파라미터를 Twelve Data API가 지원하는 형식으로 정규화합니다."""
    if not interval:
        return "1day"
    
    interval_lower = interval.lower().strip()
    
    # 직접 매핑된 값이 있으면 반환
    if interval_lower in SUPPORTED_INTERVALS:
        return SUPPORTED_INTERVALS[interval_lower]
    
    # 기본값 반환 (1day)
    print(f"[Warning] 지원되지 않는 interval '{interval}', 기본값 '1day' 사용")
    return "1day"


@register_tool
async def fetch_market_time_series(
    symbol: str,
    db: Session,
    client: httpx.AsyncClient,
    interval: str = "1day",
) -> list:
    """
    특정 종목(symbol)의 시계열 OHLCV 데이터를 요청된 기간(interval) 단위로 조회합니다.
    
    지원되는 interval: 1min, 5min, 15min, 30min, 1h, 2h, 4h, 1day, 1week, 1month
    """
    # interval 정규화
    normalized_interval = _normalize_interval(interval)
    print(f"[Cache Check] Twelve Data API 호출: /time_series?symbol={symbol}&interval={normalized_interval}")
    url = f"{TWELVE_DATA_BASE_URL}/time_series?symbol={symbol}&interval={normalized_interval}&outputsize=5000&apikey={TWELVE_DATA_API_KEY}"
    
    try:
        response = await client.get(url)
        response.raise_for_status()
        data = response.json()
        if data.get("status") == "error": raise Exception(data.get("message"))
        
        for item in data.get("values", []):
            db_item = models.MarketTimeSeries(
                symbol=data.get("meta", {}).get("symbol"),
                interval=data.get("meta", {}).get("interval"),
                datetime=datetime.fromtimestamp(int(item.get("timestamp"))),
                open=item.get("open"),
                high=item.get("high"),
                low=item.get("low"),
                close=item.get("close"),
                volume=item.get("volume")
            )
            db.merge(db_item)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"fetch_market_time_series 에러: {e}")

    final_data = db.query(models.MarketTimeSeries)\
                   .filter_by(symbol=symbol, interval=normalized_interval)\
                   .order_by(models.MarketTimeSeries.datetime.desc())\
                   .limit(1000).all()
    return [{"datetime": ts.datetime.isoformat(), "open": ts.open, "high": ts.high, "low": ts.low, "close": ts.close, "volume": ts.volume} for ts in final_data]

