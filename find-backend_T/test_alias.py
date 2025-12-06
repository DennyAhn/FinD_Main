import asyncio
import httpx
from app.database import SessionLocal
from app.services.earnings_service import fetch_earnings_surprises

async def main():
    db = SessionLocal()
    async with httpx.AsyncClient() as client:
        print("Testing alias: fetch_earnings_surprises('NVDA')...")
        try:
            results = await fetch_earnings_surprises("NVDA", db, client, limit=1)
            print("\n[ALIAS TEST RESULT]")
            if results and len(results) > 0:
                print(f"Success! Returned {len(results)} records.")
                print(f"Data: {results[0]}")
            else:
                print("Returned empty list.")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
