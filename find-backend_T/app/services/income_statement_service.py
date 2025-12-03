"""손익계산서 데이터를 조회하고 저장하는 서비스."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, List

import httpx
from sqlalchemy.orm import Session

from app import models
from app.config import FMP_API_KEY, FMP_BASE_URL
from app.mcp.decorators import register_tool

INCOME_STATEMENT_URL = f"{FMP_BASE_URL}/income-statement"
CACHE_TTL = timedelta(days=90)  # report_date 기준 3개월


def _extract_year(value: Any, fallback_date: datetime) -> int:
    if isinstance(value, int):
        return value
    if isinstance(value, str) and value.isdigit():
        return int(value)
    return fallback_date.year


@register_tool
async def fetch_company_income_statements(
    ticker: str,
    db: Session,
    client: httpx.AsyncClient,
    period: str = "annual",
    limit: int = 5,
) -> List[Dict[str, Any]]:
    """FMP API에서 손익계산서를 조회하여 DB에 저장하고 반환합니다."""

    normalized_period = (period or "annual").lower()
    if normalized_period == "quarterly":
        normalized_period = "quarter"
    if normalized_period not in {"annual", "quarter"}:
        raise ValueError("period 값은 'annual' 또는 'quarter'만 지원합니다.")

    limit = max(1, min(limit, 12))

    latest_record = (
        db.query(models.CompanyIncomeStatement)
        .filter_by(ticker=ticker, period=normalized_period)
        .order_by(models.CompanyIncomeStatement.report_date.desc())
        .first()
    )

    needs_update = True
    if latest_record and latest_record.report_date:
        # report_date 기준으로 3개월 이내면 캐시 유효
        today = datetime.utcnow().date()
        if latest_record.report_date >= today - CACHE_TTL:
            needs_update = False

    if needs_update:
        url = (
            f"{INCOME_STATEMENT_URL}/{ticker}"
            f"?period={normalized_period}&limit={limit}&apikey={FMP_API_KEY}"
        )
        try:
            response = await client.get(url)
            response.raise_for_status()
            payload = response.json() or []
        except Exception as exc:
            print(f"fetch_company_income_statements 호출 실패: {exc}")
            payload = []

        for item in payload:
            date_raw = item.get("date")
            try:
                report_date = datetime.fromisoformat(date_raw).date() if date_raw else None
            except ValueError:
                report_date = None
            if not report_date:
                continue

            # 유니크 제약조건 (ticker, period, report_date)로 기존 레코드 찾기
            existing = (
                db.query(models.CompanyIncomeStatement)
                .filter_by(
                    ticker=ticker,
                    period=normalized_period,
                    report_date=report_date
                )
                .first()
            )

            if existing:
                # 기존 레코드 업데이트
                existing.report_year = _extract_year(item.get("calendarYear"), datetime.combine(report_date, datetime.min.time()))
                existing.revenue = item.get("revenue")
                existing.cost_of_revenue = item.get("costOfRevenue")
                existing.gross_profit = item.get("grossProfit")
                existing.operating_income = item.get("operatingIncome")
                existing.net_income = item.get("netIncome")
                existing.eps = item.get("eps")
                existing.diluted_eps = item.get("epsdiluted")
                existing.operating_expenses = item.get("operatingExpenses")
                existing.ebitda = item.get("ebitda")
            else:
                # 새 레코드 추가
                record = models.CompanyIncomeStatement(
                    ticker=ticker,
                    period=normalized_period,
                    report_date=report_date,
                    report_year=_extract_year(item.get("calendarYear"), datetime.combine(report_date, datetime.min.time())),
                    revenue=item.get("revenue"),
                    cost_of_revenue=item.get("costOfRevenue"),
                    gross_profit=item.get("grossProfit"),
                    operating_income=item.get("operatingIncome"),
                    net_income=item.get("netIncome"),
                    eps=item.get("eps"),
                    diluted_eps=item.get("epsdiluted"),
                    operating_expenses=item.get("operatingExpenses"),
                    ebitda=item.get("ebitda"),
                )
                db.add(record)
        db.commit()

    records = (
        db.query(models.CompanyIncomeStatement)
        .filter_by(ticker=ticker, period=normalized_period)
        .order_by(models.CompanyIncomeStatement.report_date.desc())
        .limit(limit)
        .all()
    )

    return [
        {
            "ticker": record.ticker,
            "period": record.period,
            "report_date": record.report_date.isoformat(),
            "report_year": record.report_year,
            "revenue": record.revenue,
            "cost_of_revenue": record.cost_of_revenue,
            "gross_profit": record.gross_profit,
            "operating_income": record.operating_income,
            "net_income": record.net_income,
            "eps": float(record.eps) if record.eps is not None else None,
            "diluted_eps": float(record.diluted_eps) if record.diluted_eps is not None else None,
            "operating_expenses": record.operating_expenses,
            "ebitda": record.ebitda,
        }
        for record in records
    ]

