"""간단한 FMP 응답 확인 스크립트."""

import argparse
import asyncio
import json
from typing import Any

import httpx

from app.config import FMP_API_KEY, FMP_BASE_URL


async def fetch_json(url: str) -> Any:
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        return resp.json()


async def main(ticker: str, period: str = "annual") -> None:
    key_metrics_url = f"{FMP_BASE_URL}/key-metrics/{ticker}?period={period}&limit=1&apikey={FMP_API_KEY}"
    ratios_url = f"{FMP_BASE_URL}/financial-ratios/{ticker}?period={period}&limit=1&apikey={FMP_API_KEY}"

    key_metrics = await fetch_json(key_metrics_url)
    ratios = await fetch_json(ratios_url)

    print("=== key-metrics ===")
    print(json.dumps(key_metrics, indent=2, ensure_ascii=False))
    print("\n=== financial-ratios ===")
    print(json.dumps(ratios, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Inspect FMP key metrics/ratios response")
    parser.add_argument("ticker", help="티커 심볼 (예: AAPL)")
    parser.add_argument("--period", default="annual", choices=["annual", "quarter"], help="조회 주기")
    args = parser.parse_args()

    asyncio.run(main(args.ticker, args.period))

