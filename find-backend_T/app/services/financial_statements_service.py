"""재무제표 위젯 생성 서비스."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

import httpx
from sqlalchemy.orm import Session

from app import models
from app.services.financial_statements_income_view import build_income_statement_view
from app.services.financial_statements_balance_view import build_balance_sheet_view
from app.services.financial_statements_cash_flow_view import build_cash_flow_view


async def fetch_financial_statements_view(
    ticker: str,
    db: Session,
    client: httpx.AsyncClient,
    sub_tab: str = "income",
    period: str = "annual",
    year_range: int = 3,
) -> Dict[str, Any]:
    """
    재무제표 뷰를 위한 위젯 리스트를 생성합니다.
    sub_tab: "income" | "balance" | "cash_flow"
    period: "annual" | "quarter"
    year_range: 1 | 2 | 3 (분기별 데이터 범위, 연간일 때는 무시)
    """
    sub_tabs = [
        {"id": "income", "label": "손익계산서"},
        {"id": "balance", "label": "재무상태표"},
        {"id": "cash_flow", "label": "현금흐름표"},
    ]

    if sub_tab == "income":
        # 손익계산서 뷰는 전용 모듈로 분리
        return await build_income_statement_view(ticker, db, client, sub_tabs, period, year_range)
    elif sub_tab == "balance":
        return await build_balance_sheet_view(ticker, db, client, sub_tabs, period, year_range)
    elif sub_tab == "cash_flow":
        return await build_cash_flow_view(ticker, db, client, sub_tabs, period, year_range)
    else:
        return await build_income_statement_view(ticker, db, client, sub_tabs, period, year_range)





