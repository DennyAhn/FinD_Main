import asyncio
import httpx
import sys
import os

# Add project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.services.cash_flow_service import fetch_company_cash_flows
from app.services.insider_service import fetch_insider_trades

async def verify_endpoints():
    ticker = "AAPL"
    db = SessionLocal()
    async with httpx.AsyncClient() as client:
        print(f"--- Verifying Cash Flow for {ticker} ---")
        try:
            cash_flow_data = await fetch_company_cash_flows(ticker, db, client)
            if "widgets" in cash_flow_data:
                print("✅ Cash Flow Widgets found:")
                for w in cash_flow_data["widgets"]:
                    print(f"  - {w['type']}: {w['title']}")
            else:
                print("❌ Cash Flow Widgets NOT found in response.")
        except Exception as e:
            print(f"❌ Cash Flow Error: {e}")

        print(f"\n--- Verifying Insider Trading for {ticker} ---")
        try:
            insider_data = await fetch_insider_trades(ticker, db, client)
            if isinstance(insider_data, list):
                print(f"✅ Insider Trades found: {len(insider_data)} records")
                if len(insider_data) > 0:
                    print(f"  - First trade: {insider_data[0]}")
            else:
                print("❌ Insider Trades response is not a list.")
        except Exception as e:
            print(f"❌ Insider Trading Error: {e}")
    
    db.close()

if __name__ == "__main__":
    asyncio.run(verify_endpoints())
