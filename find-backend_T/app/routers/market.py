# app/routers/market.py (Tool 분리 버전)

import httpx
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.services.market_service import fetch_stock_quote

router = APIRouter(
    prefix="/api/v1/market",
    tags=["Market"]
)

def get_httpx_client(request: Request) -> httpx.AsyncClient:
    return request.app.state.httpx_client

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- 기존의 테스트용 엔드포인트 (이제 위 "도구"를 사용하도록 변경) ---
@router.get("/quote/{ticker}")
async def get_market_quote_test(
    ticker: str,
    client: httpx.AsyncClient = Depends(get_httpx_client),
    db: Session = Depends(get_db)
):
    """
    개발 테스트용: fetch_stock_quote 도구가 잘 작동하는지 테스트합니다.
    """
    quote_data = await fetch_stock_quote(ticker, db, client)
    if not quote_data:
        raise HTTPException(
            status_code=404,
            detail="Twelve Data에서 정보를 가져오는데 실패했습니다."
        )

    return {
        "symbol": quote_data.get("symbol"),
        "name": quote_data.get("name"),
        "exchange": quote_data.get("exchange"),
        "close": quote_data.get("close"),
        "change": quote_data.get("change"),
        "percent_change": quote_data.get("percent_change"),
    }

@router.get("/server-time")
async def get_server_time():
    """
    서버의 현재 시간을 반환합니다.
    클라이언트가 서버 시간과 동기화하기 위해 사용합니다.
    """
    from datetime import timezone
    # timezone-aware UTC datetime 사용
    now = datetime.now(timezone.utc)
    # UTC 기준 타임스탬프 (밀리초)
    timestamp_ms = int(now.timestamp() * 1000)
    return {
        "timestamp": timestamp_ms,
        "iso": now.isoformat(),
        "utc": now.timestamp()
    }