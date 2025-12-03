"""뉴스 및 애널리스트 평가 데이터를 선적재하는 통합 스크립트.

이 스크립트는 뉴스와 애널리스트 평가 데이터를 모두 수집합니다.
개별 스크립트를 사용하려면:
- 뉴스만: python -m scripts.preload_news
- 애널리스트만: python -m scripts.preload_ratings
"""

import asyncio
from typing import Sequence

import httpx

from app.database import SessionLocal
from app.services.news_service import fetch_and_store_latest_news
from app.services.ratings_service import fetch_analyst_ratings
from app.services.profile_service import fetch_company_profile

# S&P 시가총액 상위 20개 티커
SP_TOP_TICKERS: Sequence[str] = (
    "AAPL", "MSFT", "AMZN", "NVDA", "GOOGL",
    "META", "TSLA", "LLY", "AVGO", "JPM",
    "V", "UNH", "JNJ", "XOM", "PG", "MRK", "COST",
)

RATE_LIMIT_DELAY = 0.6  # 초당 호출 제한 완화용


async def preload_news(client: httpx.AsyncClient) -> None:
    """전체 뉴스 데이터를 수집합니다."""
    print("[START] 뉴스 데이터 수집 시작...")
    with SessionLocal() as db:
        try:
            await fetch_and_store_latest_news(db, client)
            print("[DONE] 뉴스 데이터 수집 완료")
        except Exception as exc:
            print(f"[ERROR] 뉴스 수집 실패: {exc}")


async def preload_ratings_for_ticker(ticker: str, client: httpx.AsyncClient) -> None:
    """단일 티커의 애널리스트 평가 데이터를 적재합니다."""
    print(f"[START] {ticker} 애널리스트 평가 수집...")
    with SessionLocal() as db:
        try:
            # Foreign Key 제약조건을 위해 먼저 프로필 생성
            await fetch_company_profile(ticker=ticker, db=db, client=client)
            # 애널리스트 평가 데이터 수집
            await fetch_analyst_ratings(ticker=ticker, db=db, client=client, limit=20)
            print(f"[DONE] {ticker} 애널리스트 평가 완료")
        except Exception as exc:
            print(f"[ERROR] {ticker} 애널리스트 평가 실패: {exc}")
            import traceback
            traceback.print_exc()


async def main() -> None:
    """뉴스 및 애널리스트 평가 데이터를 선적재합니다."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        # 1. 뉴스 데이터 수집 (전체)
        await preload_news(client)
        await asyncio.sleep(RATE_LIMIT_DELAY)
        
        # 2. 각 티커별 애널리스트 평가 수집
        for ticker in SP_TOP_TICKERS:
            await preload_ratings_for_ticker(ticker, client)
            await asyncio.sleep(RATE_LIMIT_DELAY)


if __name__ == "__main__":
    asyncio.run(main())

