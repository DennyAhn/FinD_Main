import asyncio
import sys
import json
from pathlib import Path
import httpx

# Add project root to sys.path
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.database import SessionLocal
from app.services.fetch_service import fetch_valuation_data, fetch_cash_flow_data
from app.services.analyzers.valuation_analyzer import analyze_valuation
from app.services.presenters.valuation_presenter import present_valuation
from app.services.analyzers.cash_flow_analyzer import analyze_cash_flow
from app.services.presenters.cash_flow_presenter import present_cash_flow

async def test_valuation(ticker: str):
    print(f"\n--- Testing Valuation Framework for {ticker} ---")
    async with httpx.AsyncClient() as client:
        with SessionLocal() as db:
            # 1. Fetch
            print("[1] Fetching Data...")
            data = await fetch_valuation_data(ticker, db, client)
            
            # 2. Analyze
            print("[2] Analyzing Data...")
            analysis = analyze_valuation(data)
            print(f"   Score: {analysis['score']}, Status: {analysis['status']}")
            print(f"   Insights: {analysis['insights']}")
            
            # 3. Present
            print("[3] Presenting Data (Widgets)...")
            result = present_valuation(ticker, "annual", analysis)
            print(json.dumps(result.dict(), indent=2, ensure_ascii=False))

async def test_cash_flow(ticker: str):
    print(f"\n--- Testing Cash Flow Framework for {ticker} ---")
    async with httpx.AsyncClient() as client:
        with SessionLocal() as db:
            # 1. Fetch
            print("[1] Fetching Data...")
            data = await fetch_cash_flow_data(ticker, db, client)
            
            # 2. Analyze
            print("[2] Analyzing Data...")
            analysis = analyze_cash_flow(data)
            print(f"   Score: {analysis['score']}, Status: {analysis['status']}")
            print(f"   Insights: {analysis['insights']}")
            
            # 3. Present
            print("[3] Presenting Data (Widgets)...")
            result = present_cash_flow(ticker, "annual", analysis)
            print(json.dumps(result.dict(), indent=2, ensure_ascii=False))

async def main():
    ticker = "AAPL"
    await test_valuation(ticker)
    await test_cash_flow(ticker)

if __name__ == "__main__":
    asyncio.run(main())
