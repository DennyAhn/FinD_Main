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

async def main():
    ticker = "AAPL"
    print(f"Checking ratings for {ticker}...")
    
    async with httpx.AsyncClient() as client:
        # Check price-target-consensus
        url_target = f"{FMP_BASE_URL}/price-target-consensus/{ticker}?apikey={FMP_API_KEY}"
        print(f"Fetching: {url_target}")
        resp_target = await client.get(url_target)
        if resp_target.status_code == 200:
            data = resp_target.json()
            print(f"Target Price Data (First 3):")
            print(json.dumps(data[:3], indent=2))
        else:
            print(f"Error fetching target: {resp_target.status_code}")

        # Check analyst-stock-recommendations
        url_rec = f"{FMP_BASE_URL}/analyst-stock-recommendations/{ticker}?limit=5&apikey={FMP_API_KEY}"
        print(f"Fetching: {url_rec}")
        resp_rec = await client.get(url_rec)
        if resp_rec.status_code == 200:
            data = resp_rec.json()
            print(f"Recommendations Data (First 3):")
            print(json.dumps(data[:3], indent=2))
        else:
            print(f"Error fetching recommendations: {resp_rec.status_code}")

if __name__ == "__main__":
    asyncio.run(main())
