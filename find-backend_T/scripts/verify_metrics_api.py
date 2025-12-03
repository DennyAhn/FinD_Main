import asyncio
import httpx
import sys
import os
import json

# Add project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.services.key_metrics_service import fetch_company_key_metrics

async def verify_metrics_api():
    ticker = "NVDA"
    db = SessionLocal()
    async with httpx.AsyncClient() as client:
        print(f"--- Verifying Metrics API for {ticker} ---")
        try:
            # Call the service function directly as the router does
            data = await fetch_company_key_metrics(ticker, db, client, limit=5)
            
            if "records" in data:
                records = data["records"]
                print(f"✅ Records found: {len(records)}")
                for i, r in enumerate(records):
                    print(f"  [{i}] Date: {r.get('date')} | Market Cap: {r.get('market_cap')}")
            else:
                print("❌ No records in response")
                
        except Exception as e:
            print(f"❌ Error: {e}")
    
    db.close()

if __name__ == "__main__":
    asyncio.run(verify_metrics_api())
