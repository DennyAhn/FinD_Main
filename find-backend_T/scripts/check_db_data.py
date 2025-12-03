import asyncio
import sys
import os
from sqlalchemy import text

# Add project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app import models

def check_db_data():
    ticker = "AAPL"
    db = SessionLocal()
    print(f"--- Checking DB Data for {ticker} ---")

    # 1. Check Insider Trades
    try:
        trades_count = db.query(models.InsiderTrade).filter(models.InsiderTrade.ticker == ticker).count()
        print(f"✅ Insider Trades Count: {trades_count}")
        if trades_count > 0:
            first_trade = db.query(models.InsiderTrade).filter(models.InsiderTrade.ticker == ticker).first()
            print(f"  - Sample: {first_trade.transaction_date} | {first_trade.insider_name} | {first_trade.transaction_type} | {first_trade.volume}")
        else:
            print("❌ No Insider Trades found.")
    except Exception as e:
        print(f"❌ Error checking Insider Trades: {e}")

    # 2. Check Market Cap (in Key Metrics)
    try:
        metrics = db.query(models.CompanyKeyMetrics).filter(models.CompanyKeyMetrics.ticker == ticker).order_by(models.CompanyKeyMetrics.report_date.desc()).first()
        if metrics:
            print(f"✅ Key Metrics Found (Latest: {metrics.report_date})")
            print(f"  - Market Cap: {metrics.market_cap}")
            if metrics.market_cap is None:
                print("❌ Market Cap is NULL in Key Metrics.")
        else:
            print("❌ No Key Metrics found.")
    except Exception as e:
        print(f"❌ Error checking Key Metrics: {e}")

    db.close()

if __name__ == "__main__":
    check_db_data()
