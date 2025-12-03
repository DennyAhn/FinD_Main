"""상위 티커 재무 데이터를 선적재하는 스크립트."""

import asyncio
from typing import Sequence

import sys
from pathlib import Path

# Add project root to sys.path
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import httpx

from app.database import SessionLocal
from app.services.profile_service import fetch_company_profile
from app.services.income_statement_service import fetch_company_income_statements
from app.services.balance_sheet_service import fetch_company_balance_sheets
from app.services.cash_flow_service import fetch_company_cash_flows
from app.services.key_metrics_service import fetch_company_key_metrics

# S&P 시가총액 상위 20개 티커 예시 (필요에 따라 조정 가능)
SP_TOP_TICKERS: Sequence[str] = (
    "AAPL", "MSFT", "AMZN", "NVDA", "GOOGL",
    "META", "TSLA", "LLY", "AVGO", "JPM",
    "V", "UNH", "JNJ", "XOM", "PG", "MRK", "COST",
)

ANNUAL_LIMIT = 5
QUARTER_LIMIT = 8
RATE_LIMIT_DELAY = 0.6  # 초당 호출 제한 완화용


async def preload_ticker(ticker: str, client: httpx.AsyncClient) -> None:
    """단일 티커의 프로필 및 재무 데이터를 적재합니다."""

    print(f"[START] {ticker}")
    with SessionLocal() as db:
        try:
            await fetch_company_profile(ticker, db, client)

            await fetch_company_income_statements(ticker, db, client, period="annual", limit=ANNUAL_LIMIT)
            await fetch_company_income_statements(ticker, db, client, period="quarter", limit=QUARTER_LIMIT)

            await fetch_company_balance_sheets(ticker, db, client, period="annual", limit=ANNUAL_LIMIT)
            await fetch_company_balance_sheets(ticker, db, client, period="quarter", limit=QUARTER_LIMIT)

            await fetch_company_cash_flows(ticker, db, client, period="annual", limit=ANNUAL_LIMIT)
            await fetch_company_cash_flows(ticker, db, client, period="quarter", limit=QUARTER_LIMIT)

            await fetch_company_key_metrics(ticker, db, client, period="annual", limit=ANNUAL_LIMIT)
            await fetch_company_key_metrics(ticker, db, client, period="quarter", limit=QUARTER_LIMIT)

            print(f"[DONE]  {ticker}")
        except Exception as exc:  # pragma: no cover - 초기 적재 시 오류 로깅
            print(f"[ERROR] {ticker}: {exc}")


async def main() -> None:
    async with httpx.AsyncClient(timeout=30.0) as client:
        for ticker in SP_TOP_TICKERS:
            await preload_ticker(ticker, client)
            await asyncio.sleep(RATE_LIMIT_DELAY)


if __name__ == "__main__":
    asyncio.run(main())

