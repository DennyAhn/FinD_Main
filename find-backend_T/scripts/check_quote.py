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
    url = f"{FMP_BASE_URL}/quote/{ticker}?apikey={FMP_API_KEY}"
    print(f"Fetching: {url}")
    async with httpx.AsyncClient() as client:
        resp = await client.get(url)
        data = resp.json()
        if data:
            print("Quote Keys:", data[0].keys())
            print("Quote Sample:", data[0])
        else:
            print("Quote: No data")

if __name__ == "__main__":
    asyncio.run(main())
