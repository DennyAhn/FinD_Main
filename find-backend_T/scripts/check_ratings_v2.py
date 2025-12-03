import asyncio
import sys
from pathlib import Path
import httpx
import json

# Add project root to sys.path
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.config import FMP_API_KEY, FMP_BASE_URL
from app.database import SessionLocal
from app import models

async def main():
    ticker = "AAPL"
    print(f"Checking DB and alternative endpoints for {ticker}...")
    
    # Check DB
    with SessionLocal() as db:
        record = db.query(models.AnalystRating).filter_by(ticker=ticker).order_by(models.AnalystRating.date.desc()).first()
        if record:
            print(f"DB Record ({record.date}): Target={record.price_target}")
        else:
            print("DB Record: None")

    async with httpx.AsyncClient() as client:
        # Check v4 price-target-consensus (sometimes v4 is better)
        # Try adding limit to see if it gives history
        url_v4 = f"https://financialmodelingprep.com/api/v4/price-target-consensus?symbol={ticker}&limit=5&apikey={FMP_API_KEY}"
        print(f"Fetching: {url_v4}")
        resp_v4 = await client.get(url_v4)
        if resp_v4.status_code == 200:
            print(f"V4 Consensus: {resp_v4.json()}")
        else:
            print(f"V4 Error: {resp_v4.status_code}")

        # Check price-target (list of all targets) - limit 1 to see structure
        url_pt = f"https://financialmodelingprep.com/api/v4/price-target?symbol={ticker}&apikey={FMP_API_KEY}"
        print(f"Fetching: {url_pt}")
        resp_pt = await client.get(url_pt)
        if resp_pt.status_code == 200:
            data = resp_pt.json()
            if data:
                print(f"Price Target V4 (Latest): {data[0]}")
            else:
                print("Price Target V4: Empty")
        else:
            print(f"Price Target V4 Error: {resp_pt.status_code}")

if __name__ == "__main__":
    asyncio.run(main())
