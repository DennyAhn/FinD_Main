import asyncio
import httpx
import sys
import os

# Add project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.services.insider_service import fetch_insider_trades

async def populate_insider_data():
    ticker = "AAPL"
    db = SessionLocal()
    async with httpx.AsyncClient() as client:
        print(f"--- Populating Insider Trading Data for {ticker} ---")
        try:
            # Force fetch by calling the service
            trades = await fetch_insider_trades(ticker, db, client)
            print(f"✅ Fetched {len(trades)} trades.")
            if len(trades) > 0:
                print(f"  - First trade: {trades[0]}")
        except Exception as e:
            print(f"❌ Error fetching Insider Trades: {e}")
    
    db.close()

if __name__ == "__main__":
    asyncio.run(populate_insider_data())
