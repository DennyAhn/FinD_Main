import asyncio
from datetime import date
from app.database import SessionLocal
from app.models import EarningsCalendar

def main():
    db = SessionLocal()
    # Delete anything beyond 'today' (simulation date is 2025-12-06)
    # But wait, 2026 data is definitely future.
    # 2025-05-28 is PAST in this simulation.
    # The user says "NVDA recent earnings is Nov".
    # Nov 2024? Or Nov 2025?
    # If today is Dec 2025. Then Nov 2025 was recent.
    # My DB shows 2025-05-28. It implies there should be a Nov 2025 result too if it happened.
    # FMP's 'historical-earnings-calendar' gives list.
    # Let's clean up explicitly to ensure good data.
    
    deleted = db.query(EarningsCalendar).filter(EarningsCalendar.date > "2025-12-06").delete()
    db.commit()
    print(f"Deleted {deleted} future records.")
    
    # Check what remains
    rows = db.query(EarningsCalendar).filter_by(ticker="NVDA").order_by(EarningsCalendar.date.desc()).all()
    for r in rows:
        print(f"Remaining: {r.date} | EPS: {r.eps_actual}")

if __name__ == "__main__":
    main()
