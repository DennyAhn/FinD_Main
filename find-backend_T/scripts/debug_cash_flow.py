import asyncio
import sys
from pathlib import Path
import httpx

# Add project root to sys.path
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.database import SessionLocal
from app.services.cash_flow_service import fetch_company_cash_flows

async def main():
    ticker = "AAPL"
    print(f"Testing fetch_company_cash_flows for {ticker}...")
    
    async with httpx.AsyncClient() as client:
        with SessionLocal() as db:
            result = await fetch_company_cash_flows(ticker, db, client)
            print(f"Return Type: {type(result)}")
            print(f"Return Value: {result}")

if __name__ == "__main__":
    asyncio.run(main())
