import asyncio
import httpx
import sys
import os

# Add project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.services.key_metrics_service import fetch_company_key_metrics

async def debug_metrics():
    ticker = "AAPL" # Test with a known ticker
    db = SessionLocal()
    async with httpx.AsyncClient() as client:
        print(f"--- Debugging Key Metrics for {ticker} ---")
        try:
            data = await fetch_company_key_metrics(ticker, db, client)
            
            if not data or "records" not in data:
                print("❌ No data returned or missing 'records' key")
                return

            records = data["records"]
            if not records:
                print("❌ 'records' list is empty")
                return

            latest = records[0]
            print("✅ Latest Record Found:")
            print(f"  - Report Date: {latest.get('report_date')}")
            
            # Check fields required for Health Score
            roe = latest.get('return_on_equity')
            de = latest.get('debt_to_equity')
            peg = latest.get('peg_ratio')
            pbr = latest.get('price_to_book_ratio')

            print(f"  - ROE (return_on_equity): {roe} ({'✅ OK' if roe is not None else '❌ MISSING'})")
            print(f"  - Debt/Equity (debt_to_equity): {de} ({'✅ OK' if de is not None else '❌ MISSING'})")
            print(f"  - PEG Ratio (peg_ratio): {peg} ({'✅ OK' if peg is not None else '❌ MISSING'})")
            print(f"  - PBR (price_to_book_ratio): {pbr} ({'✅ OK' if pbr is not None else '❌ MISSING'})")

            if roe is None or de is None or (peg is None and pbr is None):
                print("\n⚠️ CONCLUSION: Data Insufficient for Health Score calculation.")
            else:
                print("\n✅ CONCLUSION: Data is sufficient.")

        except Exception as e:
            print(f"❌ Error: {e}")
    
    db.close()

if __name__ == "__main__":
    asyncio.run(debug_metrics())
