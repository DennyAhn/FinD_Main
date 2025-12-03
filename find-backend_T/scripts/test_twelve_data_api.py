"""Twelve Data API 상태를 확인하는 스크립트."""

import asyncio
import sys
from pathlib import Path

# 프로젝트 루트를 sys.path에 추가
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import httpx
import json
from app.config import TWELVE_DATA_API_KEY, TWELVE_DATA_BASE_URL

async def test_twelve_data_api():
    """Twelve Data API 상태를 테스트합니다."""
    
    print("=" * 60)
    print("Twelve Data API 상태 확인")
    print("=" * 60)
    print(f"API Base URL: {TWELVE_DATA_BASE_URL}")
    print(f"API Key: {TWELVE_DATA_API_KEY[:10]}..." if TWELVE_DATA_API_KEY else "API Key: None")
    print()
    
    if not TWELVE_DATA_API_KEY:
        print("❌ API 키가 설정되지 않았습니다!")
        return
    
    test_tickers = ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'META']
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        for ticker in test_tickers:
            print(f"\n{'='*60}")
            print(f"테스트 티커: {ticker}")
            print(f"{'='*60}")
            
            url = f"{TWELVE_DATA_BASE_URL}/quote?symbol={ticker}&apikey={TWELVE_DATA_API_KEY}"
            print(f"URL: {url}")
            
            try:
                response = await client.get(url)
                print(f"Status Code: {response.status_code}")
                print(f"Response Headers: {dict(response.headers)}")
                
                if response.status_code == 200:
                    data = response.json()
                    print(f"Response Type: {type(data)}")
                    
                    if isinstance(data, dict):
                        if data.get("status") == "error":
                            print(f"❌ API Error: {data.get('message', 'Unknown error')}")
                            print(f"Response Data: {json.dumps(data, indent=2, ensure_ascii=False)}")
                        else:
                            print(f"✅ 성공!")
                            print(f"Response Keys: {list(data.keys())}")
                            print(f"Sample Data:")
                            print(json.dumps({k: v for k, v in list(data.items())[:5]}, indent=2, ensure_ascii=False))
                    elif isinstance(data, list):
                        print(f"✅ 성공! (List with {len(data)} items)")
                        if len(data) > 0:
                            print(f"First Item Keys: {list(data[0].keys()) if isinstance(data[0], dict) else 'N/A'}")
                    else:
                        print(f"Response: {data}")
                        
                elif response.status_code == 429:
                    print("❌ Rate Limit 초과!")
                    print(f"Response: {response.text[:200]}")
                    
                elif response.status_code == 401:
                    print("❌ 인증 실패 (API 키 문제 가능)")
                    print(f"Response: {response.text[:200]}")
                    
                elif response.status_code == 500:
                    print("❌ Twelve Data 서버 에러 (500)")
                    print(f"Response: {response.text[:200]}")
                    
                else:
                    print(f"❌ 예상치 못한 상태 코드: {response.status_code}")
                    print(f"Response: {response.text[:500]}")
                    
            except httpx.TimeoutException:
                print("❌ 타임아웃 에러 (30초 초과)")
            except httpx.RequestError as e:
                print(f"❌ 요청 에러: {e}")
            except Exception as e:
                print(f"❌ 예외 발생: {e}")
                import traceback
                traceback.print_exc()
            
            # Rate limit 방지를 위해 잠시 대기
            await asyncio.sleep(1)
    
    # API 키 상태 확인 (다른 엔드포인트 테스트)
    print(f"\n{'='*60}")
    print("API 키 상태 확인 (time_series 엔드포인트 테스트)")
    print(f"{'='*60}")
    
    test_url = f"{TWELVE_DATA_BASE_URL}/time_series?symbol=AAPL&interval=1day&outputsize=1&apikey={TWELVE_DATA_API_KEY}"
    print(f"URL: {test_url}")
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(test_url)
            print(f"Status Code: {response.status_code}")
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, dict) and data.get("status") == "error":
                    print(f"❌ API Error: {data.get('message', 'Unknown error')}")
                    print(f"Error Code: {data.get('code', 'N/A')}")
                else:
                    print(f"✅ time_series 엔드포인트는 정상 작동합니다!")
            else:
                print(f"Response: {response.text[:300]}")
    except Exception as e:
        print(f"❌ 에러: {e}")
    
    print(f"\n{'='*60}")
    print("테스트 완료")
    print(f"{'='*60}")

if __name__ == "__main__":
    asyncio.run(test_twelve_data_api())

