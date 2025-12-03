import asyncio
import sys
import os
from sqlalchemy import text

# Add project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app import models

def check_nvda_data():
    ticker = "NVDA"
    db = SessionLocal()
    print(f"--- Checking DB Data for {ticker} ---")

    # Check Key Metrics (Current Source)
    try:
        metrics = db.query(models.CompanyKeyMetrics).filter(models.CompanyKeyMetrics.ticker == ticker).order_by(models.CompanyKeyMetrics.report_date.desc()).first()
        if metrics:
            print(f"✅ Key Metrics Found (Report Date: {metrics.report_date})")
            print(f"  - Market Cap: {metrics.market_cap}")
            print(f"  - Formatted: ${metrics.market_cap / 1e12:.2f}T")
        else:
            print("❌ No Key Metrics found.")
    except Exception as e:
        print(f"❌ Error checking Key Metrics: {e}")

    db.close()

if __name__ == "__main__":
    check_nvda_data()
