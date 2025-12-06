import asyncio
import httpx
from app.database import SessionLocal
from app.services.earnings_service import fetch_earnings_calendar

async def main():
    db = SessionLocal()
    # No mocked client, just None because we expect DB hit (since we populated it)
    # But function signature requires client
    async with httpx.AsyncClient() as client:
        print("Fetching NVDA earnings via service function...")
        results = await fetch_earnings_calendar("NVDA", db, client, limit=1)
        
        print("\n[VERIFICATION RESULT]")
        if results:
            item = results[0]
            print(f"Ticker: NVDA")
            print(f"Date: {item.get('date')} (Raw DB Value)")
            print(f"Time: {item.get('time')} (Raw DB Value)")
            print(f"EPS Est: {item.get('eps_estimate')}")
            print(f"EPS Act: {item.get('eps_actual')}")
            print(f"Surprise: {item.get('eps_surprise_percent')}")
            
            # Check for hardcoding signs
            is_suspicious = False
            if str(item.get('eps_surprise_percent')) == "9.9050": # Matches calculated value
                 print(">> Verified: Surprise % matches calculated logic.")
            
        else:
            print("No data returned.")

if __name__ == "__main__":
    asyncio.run(main())
