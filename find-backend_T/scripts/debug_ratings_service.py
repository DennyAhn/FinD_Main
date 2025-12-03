import asyncio
import sys
from pathlib import Path
import httpx
import json

# Add project root to sys.path
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.database import SessionLocal
from app.services.ratings_service import fetch_analyst_ratings

async def main():
    ticker = "AAPL"
    print(f"Testing ratings service for {ticker}...")
    
    async with httpx.AsyncClient() as client:
        with SessionLocal() as db:
            ratings = await fetch_analyst_ratings(ticker, db, client, limit=5)
            print(f"Ratings Count: {len(ratings)}")
            if ratings:
                print("Latest Rating:")
                print(json.dumps(ratings[0], indent=2))
                
                # Check if any other rating has the old price
                for r in ratings:
                    print(f"Date: {r['date']}, Target: {r['price_target']}")

if __name__ == "__main__":
    asyncio.run(main())
