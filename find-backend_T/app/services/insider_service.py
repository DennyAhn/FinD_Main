"""Insider 거래 관련 서비스 로직을 정의하는 모듈."""
# app/services/insider_service.py
import httpx, json
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from app.config import FMP_API_KEY
from app import models
from app.mcp.decorators import register_tool


@register_tool
async def fetch_insider_trades(
    ticker: str,
    db: Session,
    client: httpx.AsyncClient,
    limit: int = 20,
) -> list:
    """
    특정 티커(ticker)의 최신 내부자 거래 내역을 조회합니다.

    - FMP API에서 데이터를 가져와 DB에 적재한 뒤,
    - DB에서 **최근 3개월(90일)** 이내의 거래만 필터링하여 반환합니다.
    - 동일 티커에 대해서는 24시간 동안 API를 다시 호출하지 않습니다 (캐시).
    """
    cache_key = f"insider_trades_{ticker}"
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
        print(f"[Cache MISS] FMP API 호출: insider-trading/{ticker}")
        url = f"https://financialmodelingprep.com/api/v4/insider-trading?symbol={ticker}&limit={limit}&apikey={FMP_API_KEY}"
        try:
            response = await client.get(url)
            response.raise_for_status()
            data = response.json()
            for item in data:
                db.merge(
                    models.InsiderTrade(
                        ticker=item.get("symbol"),
                        transaction_date=item.get("transactionDate"),
                        insider_name=item.get("insiderName"),
                        transaction_type=item.get("transactionType"),
                        volume=item.get("securitiesTransacted"),
                        price=item.get("price"),
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
            print(f"fetch_insider_trades 에러: {e}")

    # --- 최종 조회: 최근 3개월(90일) 내 거래만 사용 ---
    three_months_ago = now - timedelta(days=90)

    final_trades = (
        db.query(models.InsiderTrade)
        .filter(
            models.InsiderTrade.ticker == ticker,
            models.InsiderTrade.transaction_date >= three_months_ago,
        )
        .order_by(models.InsiderTrade.transaction_date.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "date": str(t.transaction_date),
            "insider_name": t.insider_name,
            "type": t.transaction_type,
            "volume": t.volume,
        }
        for t in final_trades
    ]
