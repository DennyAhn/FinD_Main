from __future__ import annotations
from typing import Any, Dict, List, Optional, Union
from datetime import datetime
import httpx
from sqlalchemy.orm import Session

from app import models
from app.config import FMP_API_KEY, FMP_BASE_URL
from app.services.key_metrics_service import fetch_company_key_metrics
from app.services.cash_flow_service import fetch_company_cash_flows
from app.services.ratings_service import fetch_analyst_ratings

# --- Helper Functions ---

def safe_merge(target: Dict[str, Any], source: Dict[str, Any]) -> Dict[str, Any]:
    """
    소스 딕셔너리의 값을 타겟에 병합하되, 소스 값이 None이 아닌 경우에만 업데이트합니다.
    기존 값을 덮어쓰지 않고 보존하는 'Safe Merge' 전략입니다.
    """
    for key, value in source.items():
        if value is not None:
            target[key] = value
        elif key not in target:
            target[key] = None
    return target

def get_metric(data: Dict[str, Any], keys: List[str], type_conv: type = float) -> Optional[Union[float, int, str]]:
    """
    여러 키(Fallback Keys)를 순회하며 값을 찾고, 지정된 타입으로 변환합니다.
    """
    for key in keys:
        val = data.get(key)
        if val is not None:
            try:
                if type_conv == int:
                    return int(float(val)) # "100.0" -> 100
                return type_conv(val)
            except (ValueError, TypeError):
                continue
    return None

# --- Fetching Services ---

async def fetch_valuation_data(
    ticker: str,
    db: Session,
    client: httpx.AsyncClient,
    period: str = "annual"
) -> Dict[str, Any]:
    """
    Valuation 분석에 필요한 모든 데이터를 수집하고 병합합니다.
    - Key Metrics (PE, PB, PS, etc.)
    - Analyst Estimates (Forward PE, PEG)
    - Quote (Current Price)
    """
    # 1. Key Metrics & Ratios (기존 서비스 재사용)
    metrics_payload = await fetch_company_key_metrics(ticker, db, client, period=period, limit=5)
    metrics_records = metrics_payload.get("records", [])

    # 2. Analyst Ratings (Target Price)
    ratings = await fetch_analyst_ratings(ticker, db, client, limit=1)
    latest_rating = ratings[0] if ratings else {}

    # 3. 데이터 구조화 (연도별/분기별 매핑)
    # metrics_records는 이미 최신순 정렬되어 있음
    
    return {
        "metrics": metrics_records,
        "latest_rating": latest_rating,
        "meta": {
            "ticker": ticker,
            "period": period,
            "count": len(metrics_records)
        }
    }

async def fetch_cash_flow_data(
    ticker: str,
    db: Session,
    client: httpx.AsyncClient,
    period: str = "annual"
) -> Dict[str, Any]:
    """
    Cash Flow 분석에 필요한 데이터를 수집합니다.
    - Cash Flow Statement (OCF, FCF, Capex)
    - Income Statement (Net Income, Revenue) - for Margins
    """
    # 1. Cash Flow (기존 서비스 재사용 - 이미 Income Statement 요약 포함)
    cf_payload = await fetch_company_cash_flows(ticker, db, client, period=period, limit=5)
    cf_records = cf_payload.get("records", [])
    income_summary = cf_payload.get("income_summary", {})

    return {
        "cash_flows": cf_records,
        "income_summary": income_summary,
        "meta": {
            "ticker": ticker,
            "period": period,
            "count": len(cf_records)
        }
    }
