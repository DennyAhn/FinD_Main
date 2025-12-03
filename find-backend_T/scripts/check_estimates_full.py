import asyncio
import sys
from pathlib import Path
import httpx
from datetime import datetime

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.config import FMP_API_KEY, FMP_BASE_URL

async def main():
    ticker = "AAPL"
    # Fetch more records to see the timeline
    url = f"{FMP_BASE_URL}/analyst-estimates/{ticker}?period=annual&limit=30&apikey={FMP_API_KEY}"
    print(f"Fetching: {url}")
    
    async with httpx.AsyncClient() as client:
        resp = await client.get(url)
        data = resp.json()
        
        print(f"Current Year: {datetime.now().year}")
        print("-" * 50)
        if data:
            # Sort by date to see the sequence
            data.sort(key=lambda x: x['date'])
            for item in data:
                print(f"Date: {item['date']}, EstEPS: {item['estimatedEpsAvg']}")
        else:
            print("No data")

if __name__ == "__main__":
    asyncio.run(main())
