"""뉴스 데이터를 선적재하는 스크립트."""

import asyncio

import httpx

from app.database import SessionLocal
from app.services.news_service import fetch_and_store_latest_news

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
            import traceback
            traceback.print_exc()


async def main() -> None:
    """뉴스 데이터를 선적재합니다."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        await preload_news(client)


if __name__ == "__main__":
    asyncio.run(main())

