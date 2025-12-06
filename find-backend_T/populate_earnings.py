import asyncio
import httpx
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models import EarningsCalendar
# Import the service function
from app.services.earnings_service import fetch_earnings_calendar
from app.config import FMP_API_KEY # Ensure this is loaded

async def main():
    db = SessionLocal()
    ticker = "NVDA"
    
    # 1. Clear existing cache to force fetch? 
    # Actually fetch_earnings_calendar checks cache. 
    # We should delete the cache entry first if we want to force it, OR just rely on the fact the table is empty.
    
    # 1. Clear existing cache AND data
    try:
        from app.models import ApiCache
        db.query(EarningsCalendar).filter(EarningsCalendar.ticker == ticker).delete()
        # Cache key format: earnings_calendar_{ticker}
        db.query(ApiCache).filter(ApiCache.cache_key == f"earnings_calendar_{ticker}").delete()
        db.commit()
        print("Deleted existing records and cache.")
    except Exception as e:
        print(e)
        
    async with httpx.AsyncClient() as client:
        print(f"Fetching data for {ticker}...")
        # The service function expects the client to be passed
        result = await fetch_earnings_calendar(ticker, db, client, limit=5)
        
        print("\n--- FETCH RESULT ---")
        for r in result:
            print(r)
            
    # Verify DB content directly
    rows = db.query(EarningsCalendar).filter(EarningsCalendar.ticker == ticker).order_by(EarningsCalendar.date.desc()).limit(5).all()
    print("\n--- DB ROWS ---")
    for row in rows:
        print(f"Date: {row.date}, Est: {row.eps_estimate}, Act: {row.eps_actual}, Surprise: {row.eps_surprise_percent}%")

if __name__ == "__main__":
    asyncio.run(main())
