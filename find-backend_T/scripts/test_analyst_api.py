"""FMP analyst API 응답 형식을 확인하는 스크립트."""

import asyncio
import json
import httpx
from app.config import FMP_API_KEY

FMP_BASE_URL = "https://financialmodelingprep.com/api/v3"
STABLE_BASE_URL = "https://financialmodelingprep.com"


async def test_analyst_apis(ticker: str = "AAPL"):
    """analyst 관련 API 응답 형식을 확인합니다."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        # 테스트할 엔드포인트 목록
        endpoints = [
            # 1. analyst-stock-recommendations (현재 사용 중)
            {
                "name": "analyst-stock-recommendations (v3)",
                "url": f"{FMP_BASE_URL}/analyst-stock-recommendations/{ticker}?limit=5&apikey={FMP_API_KEY}"
            },
            {
                "name": "analyst-stock-recommendations (stable)",
                "url": f"{STABLE_BASE_URL}/stable/analyst-stock-recommendations/{ticker}?limit=5&apikey={FMP_API_KEY}"
            },
            # 2. price-target-consensus (목표주가)
            {
                "name": "price-target-consensus (v3)",
                "url": f"{FMP_BASE_URL}/price-target-consensus/{ticker}?apikey={FMP_API_KEY}"
            },
            {
                "name": "price-target-consensus (stable)",
                "url": f"{STABLE_BASE_URL}/stable/price-target-consensus/{ticker}?apikey={FMP_API_KEY}"
            },
            # 3. analyst-price-target (다른 가능한 엔드포인트)
            {
                "name": "analyst-price-target (v3)",
                "url": f"{FMP_BASE_URL}/analyst-price-target/{ticker}?apikey={FMP_API_KEY}"
            },
        ]
        
        for endpoint in endpoints:
            print(f"\n{'='*60}")
            print(f"=== {endpoint['name']} ===")
            print(f"URL: {endpoint['url']}")
            try:
                response = await client.get(endpoint['url'])
                print(f"Status: {response.status_code}")
                if response.status_code == 200:
                    data = response.json()
                    print(f"Response type: {type(data)}")
                    if isinstance(data, list) and len(data) > 0:
                        print(f"First item keys: {list(data[0].keys())}")
                        print(f"First item:\n{json.dumps(data[0], indent=2, ensure_ascii=False)}")
                    elif isinstance(data, dict):
                        print(f"Response keys: {list(data.keys())}")
                        print(f"Response:\n{json.dumps(data, indent=2, ensure_ascii=False)}")
                    else:
                        print(f"Response: {data}")
                elif response.status_code == 404:
                    print(f"404 Not Found (엔드포인트가 존재하지 않음)")
                else:
                    print(f"Error: {response.text[:200]}")
            except Exception as e:
                print(f"Error: {e}")


if __name__ == "__main__":
    import sys
    ticker = sys.argv[1] if len(sys.argv) > 1 else "AAPL"
    asyncio.run(test_analyst_apis(ticker))

