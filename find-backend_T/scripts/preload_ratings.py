"""애널리스트 평가 데이터를 선적재하는 스크립트."""

import asyncio
import sys
from pathlib import Path
from typing import Sequence

# Add project root to sys.path
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import httpx

from app.database import SessionLocal
from app.services.ratings_service import fetch_analyst_ratings
from app.services.profile_service import fetch_company_profile
from app import models
from datetime import datetime

# S&P 시가총액 상위 20개 티커
SP_TOP_TICKERS: Sequence[str] = (
    "AAPL", "MSFT", "AMZN", "NVDA", "GOOGL",
    "META", "TSLA", "LLY", "AVGO", "JPM",
    "V", "UNH", "JNJ", "XOM", "PG", "MRK", "COST",
)

RATE_LIMIT_DELAY = 0.6  # 초당 호출 제한 완화용


async def preload_ratings_for_ticker(ticker: str, client: httpx.AsyncClient, force_refresh: bool = False) -> None:
    """단일 티커의 애널리스트 평가 데이터를 적재합니다."""
    print(f"\n{'='*60}")
    print(f"[START] {ticker} 애널리스트 평가 수집...")
    print(f"{'='*60}")
    
    with SessionLocal() as db:
        try:
            # Foreign Key 제약조건을 위해 먼저 프로필 생성
            print(f"[1/2] 프로필 확인/생성: {ticker}")
            profile_result = await fetch_company_profile(ticker=ticker, db=db, client=client)
            if not profile_result:
                print(f"[ERROR] 프로필 생성 실패: {ticker}")
                return
            
            # 캐시 강제 삭제 (force_refresh가 True인 경우)
            if force_refresh:
                cache_key = f"analyst_ratings_{ticker}"
                db.query(models.ApiCache).filter(models.ApiCache.cache_key == cache_key).delete()
                db.commit()
                print(f"[Info] 캐시 강제 삭제: {cache_key}")
            
            # 애널리스트 평가 데이터 수집
            print(f"[2/2] 애널리스트 평가 데이터 수집: {ticker}")
            ratings_result = await fetch_analyst_ratings(ticker=ticker, db=db, client=client, limit=20)
            
            # 저장된 데이터 확인
            saved_count = db.query(models.AnalystRating).filter_by(ticker=ticker).count()
            print(f"[Info] DB에 저장된 애널리스트 평가 레코드 수: {saved_count}건")
            
            # 최신 레코드 샘플 확인
            latest = db.query(models.AnalystRating).filter_by(ticker=ticker).order_by(models.AnalystRating.date.desc()).first()
            if latest:
                print(f"[Info] 최신 레코드 샘플:")
                print(f"  - 날짜: {latest.date}")
                print(f"  - StrongBuy: {latest.analyst_ratings_strong_buy}")
                print(f"  - Buy: {latest.analyst_ratings_buy}")
                print(f"  - Hold: {latest.analyst_ratings_hold}")
                print(f"  - Sell: {latest.analyst_ratings_sell}")
                print(f"  - StrongSell: {latest.analyst_ratings_strong_sell}")
                print(f"  - Price Target: {latest.price_target if latest.price_target else 'NULL'}")
            else:
                print(f"[Warning] 저장된 레코드가 없습니다: {ticker}")
            
            print(f"[DONE] {ticker} 애널리스트 평가 완료")
        except Exception as exc:
            print(f"[ERROR] {ticker} 애널리스트 평가 실패: {exc}")
            import traceback
            traceback.print_exc()


async def main() -> None:
    """애널리스트 평가 데이터를 선적재합니다."""
    # 명령줄 인자 확인 (--force 옵션으로 캐시 무시)
    force_refresh = "--force" in sys.argv or "-f" in sys.argv
    
    if force_refresh:
        print("[Info] 캐시 무시 모드: 모든 데이터를 강제로 새로 수집합니다.")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # 각 티커별 애널리스트 평가 수집
        for ticker in SP_TOP_TICKERS:
            await preload_ratings_for_ticker(ticker, client, force_refresh=force_refresh)
            await asyncio.sleep(RATE_LIMIT_DELAY)


if __name__ == "__main__":
    print("="*60)
    print("애널리스트 평가 데이터 선적재 스크립트")
    print("="*60)
    print("사용법:")
    print("  python -m scripts.preload_ratings          # 일반 실행 (캐시 사용)")
    print("  python -m scripts.preload_ratings --force   # 캐시 무시하고 강제 수집")
    print("="*60)
    print()
    asyncio.run(main())

