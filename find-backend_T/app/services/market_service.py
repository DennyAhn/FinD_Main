# app/services/market_service.py
import httpx, json
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from app.config import FMP_API_KEY, FMP_BASE_URL
from app import models
from app.mcp.decorators import register_tool

@register_tool
async def fetch_stock_quote(ticker: str, db: Session, client: httpx.AsyncClient) -> dict:
    """
    특정 티커(ticker)의 현재 시세 및 변동률 스냅샷을 조회합니다.
    FMP Quote API를 사용하여 실시간 가격과 시가총액을 가져옵니다.
    """
    cache_key = f"fmp_quote_{ticker}"
    now = datetime.now()
    db_cache = db.query(models.ApiCache).filter(
        models.ApiCache.cache_key == cache_key,
        models.ApiCache.expires_at > now
    ).first()

    if db_cache:
        print(f"[Cache HIT] {cache_key}")
        return db_cache.data

    print(f"[Cache MISS] FMP API 호출: /quote/{ticker}")
    url = f"{FMP_BASE_URL}/quote/{ticker}?apikey={FMP_API_KEY}"
    
    try:
        response = await client.get(url)
        response.raise_for_status()
        data = response.json()
        
        if not data or not isinstance(data, list) or len(data) == 0:
            print(f"FMP API: {ticker}에 대한 데이터가 없습니다.")
            return None
        
        quote = data[0]
        
        # FMP 응답을 표준 포맷으로 변환
        quote_data = {
            "symbol": quote.get("symbol", ticker),
            "name": quote.get("name", ""),
            "exchange": quote.get("exchange", ""),
            "currency": "USD", # FMP는 주로 USD
            "datetime": datetime.fromtimestamp(quote.get("timestamp", 0)).isoformat() if quote.get("timestamp") else now.isoformat(),
            "timestamp": quote.get("timestamp", int(now.timestamp())),
            "open": float(quote.get("open", 0)),
            "high": float(quote.get("dayHigh", 0)),
            "low": float(quote.get("dayLow", 0)),
            "close": float(quote.get("price", 0)),
            "volume": int(quote.get("volume", 0)),
            "previous_close": float(quote.get("previousClose", 0)),
            "change": float(quote.get("change", 0)),
            "changePercent": float(quote.get("changesPercentage", 0)),
            "marketCap": int(quote.get("marketCap", 0)) # [NEW] 시가총액 추가
        }
        
        expires = now + timedelta(minutes=5)
        cache_entry = models.ApiCache(cache_key=cache_key, data=quote_data, expires_at=expires)
        db.merge(cache_entry)
        db.commit()
        return quote_data
    except httpx.HTTPStatusError as e:
        db.rollback()
        print(f"fetch_stock_quote HTTP 에러 ({ticker}): {e.response.status_code} - {e.response.text[:200]}")
        return None
    except Exception as e:
        db.rollback()
        print(f"fetch_stock_quote 에러 ({ticker}): {e}")
        return None