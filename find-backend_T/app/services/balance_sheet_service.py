"""대차대조표 데이터를 조회하고 저장하는 서비스."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, List

import httpx
from sqlalchemy.orm import Session

from app import models
from app.config import FMP_API_KEY, FMP_BASE_URL
from app.mcp.decorators import register_tool

BALANCE_SHEET_URL = f"{FMP_BASE_URL}/balance-sheet-statement"
CACHE_TTL = timedelta(days=90)  # report_date 기준 3개월


def _extract_year(value: Any, fallback_date: datetime) -> int:
    if isinstance(value, int):
        return value
    if isinstance(value, str) and value.isdigit():
        return int(value)
    return fallback_date.year


@register_tool
async def fetch_company_balance_sheets(
    ticker: str,
    db: Session,
    client: httpx.AsyncClient,
    period: str = "annual",
    limit: int = 5,
) -> List[Dict[str, Any]]:
    """FMP API에서 대차대조표를 조회하여 DB에 저장하고 반환합니다."""

    normalized_period = (period or "annual").lower()
    if normalized_period == "quarterly":
        normalized_period = "quarter"
    if normalized_period not in {"annual", "quarter"}:
        raise ValueError("period 값은 'annual' 또는 'quarter'만 지원합니다.")

    limit = max(1, min(limit, 12))

    latest_record = (
        db.query(models.CompanyBalanceSheet)
        .filter_by(ticker=ticker, period=normalized_period)
        .order_by(models.CompanyBalanceSheet.report_date.desc())
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
            f"{BALANCE_SHEET_URL}/{ticker}"
            f"?period={normalized_period}&limit={limit}&apikey={FMP_API_KEY}"
        )
        try:
            response = await client.get(url)
            response.raise_for_status()
            payload = response.json() or []
        except Exception as exc:
            print(f"fetch_company_balance_sheets 호출 실패: {exc}")
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
                db.query(models.CompanyBalanceSheet)
                .filter_by(
                    ticker=ticker,
                    period=normalized_period,
                    report_date=report_date
                )
                .first()
            )

            # 원시 값 추출
            total_assets_val = item.get("totalAssets")
            total_current_assets_val = item.get("totalCurrentAssets")
            total_liab_val = item.get("totalLiabilities")
            total_current_liab_val = item.get("totalCurrentLiabilities")
            total_noncurrent_liab_val = item.get("totalNonCurrentLiabilities")
            total_equity_val = item.get("totalShareholderEquity")
            # [보정] 자본이 비어 있으면 자산-부채로 추정
            if total_equity_val is None and total_assets_val is not None and total_liab_val is not None:
                total_equity_val = total_assets_val - total_liab_val

            if existing:
                # 기존 레코드 업데이트
                existing.report_year = _extract_year(item.get("calendarYear"), datetime.combine(report_date, datetime.min.time()))
                existing.total_assets = total_assets_val
                existing.total_current_assets = total_current_assets_val
                existing.total_liabilities = total_liab_val
                existing.total_current_liabilities = total_current_liab_val
                existing.total_noncurrent_liabilities = total_noncurrent_liab_val
                existing.total_equity = total_equity_val
                existing.cash_and_short_term_investments = item.get("cashAndShortTermInvestments") or item.get("cashAndCashEquivalents")
                existing.inventory = item.get("inventory")
                existing.accounts_receivable = item.get("netReceivables")
                existing.accounts_payable = item.get("accountPayables") or item.get("accountsPayables")
                existing.long_term_debt = item.get("longTermDebt")
                existing.short_term_debt = item.get("shortTermDebt")
            else:
                # 새 레코드 추가
                record = models.CompanyBalanceSheet(
                    ticker=ticker,
                    period=normalized_period,
                    report_date=report_date,
                    report_year=_extract_year(item.get("calendarYear"), datetime.combine(report_date, datetime.min.time())),
                    total_assets=total_assets_val,
                    total_current_assets=total_current_assets_val,
                    total_liabilities=total_liab_val,
                    total_current_liabilities=total_current_liab_val,
                    total_noncurrent_liabilities=total_noncurrent_liab_val,
                    total_equity=total_equity_val,
                    cash_and_short_term_investments=item.get("cashAndShortTermInvestments")
                    or item.get("cashAndCashEquivalents"),
                    inventory=item.get("inventory"),
                    accounts_receivable=item.get("netReceivables"),
                    accounts_payable=item.get("accountPayables") or item.get("accountsPayables"),
                    long_term_debt=item.get("longTermDebt"),
                    short_term_debt=item.get("shortTermDebt"),
                )
                db.add(record)
        db.commit()

    records = (
        db.query(models.CompanyBalanceSheet)
        .filter_by(ticker=ticker, period=normalized_period)
        .order_by(models.CompanyBalanceSheet.report_date.desc())
        .limit(limit)
        .all()
    )

    return [
        {
            "ticker": record.ticker,
            "period": record.period,
            "report_date": record.report_date.isoformat(),
            "report_year": record.report_year,
            "total_assets": record.total_assets,
            "total_current_assets": record.total_current_assets,
            "total_liabilities": record.total_liabilities,
            "total_equity": record.total_equity,
            "total_current_liabilities": record.total_current_liabilities,
            "total_noncurrent_liabilities": record.total_noncurrent_liabilities,
            "cash_and_short_term_investments": record.cash_and_short_term_investments,
            "inventory": record.inventory,
            "accounts_receivable": record.accounts_receivable,
            "accounts_payable": record.accounts_payable,
            "long_term_debt": record.long_term_debt,
            "short_term_debt": record.short_term_debt,
        }
        for record in records
    ]

