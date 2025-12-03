import asyncio
import sys
from pathlib import Path
import httpx

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.config import FMP_API_KEY, FMP_BASE_URL

async def main():
    ticker = "AAPL"
    # Analyst Estimates Endpoint
    url = f"{FMP_BASE_URL}/analyst-estimates/{ticker}?limit=1&apikey={FMP_API_KEY}"
    print(f"Fetching: {url}")
    
    async with httpx.AsyncClient() as client:
        resp = await client.get(url)
        print(f"Status Code: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            if data:
                print("Estimates Keys:", data[0].keys())
                print("Estimates Sample:", data[0])
            else:
                print("Estimates: No data")
        else:
            print(f"Error: {resp.text}")

if __name__ == "__main__":
    asyncio.run(main())
