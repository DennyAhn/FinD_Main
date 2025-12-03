"""수정된 fetch_stock_quote 함수 테스트."""

import asyncio
import sys
from pathlib import Path

# 프로젝트 루트를 sys.path에 추가
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import httpx
from app.database import SessionLocal
from app.services.market_service import fetch_stock_quote

async def test_quote():
    """수정된 quote 함수 테스트."""
    print("=" * 60)
    print("수정된 fetch_stock_quote 테스트")
    print("=" * 60)
    
    test_ticker = "AAPL"
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        with SessionLocal() as db:
            try:
                result = await fetch_stock_quote(test_ticker, db, client)
                
                if result:
                    print(f"\n✅ 성공!")
                    print(f"Symbol: {result.get('symbol')}")
                    print(f"Close Price: {result.get('close')}")
                    print(f"Previous Close: {result.get('previous_close')}")
                    print(f"Change: {result.get('close', 0) - result.get('previous_close', 0)}")
                    print(f"Volume: {result.get('volume')}")
                    print(f"Datetime: {result.get('datetime')}")
                else:
                    print(f"\n❌ 결과가 None입니다.")
            except Exception as e:
                print(f"\n❌ 에러 발생: {e}")
                import traceback
                traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_quote())

