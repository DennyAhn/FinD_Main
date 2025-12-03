import asyncio
import os
import sys
from pathlib import Path
import httpx

# Add project root to sys.path
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.config import FMP_API_KEY, FMP_BASE_URL

async def main():
    ticker = "AAPL"
    period = "annual"
    limit = 1
    
    async with httpx.AsyncClient() as client:
        # 1. Key Metrics
        url_metrics = f"{FMP_BASE_URL}/key-metrics/{ticker}?period={period}&limit={limit}&apikey={FMP_API_KEY}"
        print(f"Fetching: {url_metrics}")
        resp = await client.get(url_metrics)
        data = resp.json()
        if data:
            print("Key Metrics Keys:", data[0].keys())
            print("Key Metrics Sample:", data[0])
        else:
            print("Key Metrics: No data")

        # 2. Financial Ratios
        url_ratios = f"{FMP_BASE_URL}/financial-ratios/{ticker}?period={period}&limit={limit}&apikey={FMP_API_KEY}"
        print(f"Fetching: {url_ratios}")
        resp = await client.get(url_ratios)
        data = resp.json()
        if data:
            print("Financial Ratios Keys:", data[0].keys())
            print("Financial Ratios Sample:", data[0])
        else:
            print("Financial Ratios: No data")

if __name__ == "__main__":
    asyncio.run(main())
