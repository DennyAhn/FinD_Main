"""기업 실적(Earnings) 관련 서비스 로직을 정의하는 모듈."""
# app/services/earnings_service.py
import httpx, json
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from app.config import FMP_API_KEY
from app import models
from app.mcp.decorators import register_tool

FMP_BASE_URL = "https://financialmodelingprep.com/api/v3"


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
        print(f"[Cache MISS] FMP API 호출: earnings-calendar/{ticker}")
        url = f"{FMP_BASE_URL}/historical-earnings-calendar/{ticker}?limit={limit}&apikey={FMP_API_KEY}"
        try:
            response = await client.get(url)
            response.raise_for_status()
            data = response.json()
            for item in data:
                db.merge(
                    models.EarningsCalendar(
                        ticker=item.get("symbol"),
                        date=item.get("date"),
                        period=item.get("fiscalDateEnding"),
                        eps_estimate=item.get("epsEstimated"),
                        eps_actual=item.get("eps"),
                        revenue_estimate=item.get("revenueEstimated"),
                        revenue_actual=item.get("revenue"),
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
        .order_by(models.EarningsCalendar.date.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "date": str(e.date),
            "period": e.period,
            "eps_estimate": e.eps_estimate,
            "eps_actual": e.eps_actual,
        }
        for e in final_earnings
    ]