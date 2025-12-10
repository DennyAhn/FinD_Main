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
    """
    대차대조표(Balance Sheet) 데이터를 조회합니다.
    
    **Use this tool when user asks about:**
    - 총 자산 (Total Assets)
    - 총 부채 (Total Liabilities, Total Debt)
    - 자기자본 (Total Equity, Shareholders' Equity)
    - 현금 및 현금성 자산 (Cash and Cash Equivalents)
    - 유동자산 (Current Assets), 비유동자산 (Non-Current Assets)
    - 유동부채 (Current Liabilities), 비유동부채 (Non-Current Liabilities)
    - 부채비율 (Debt-to-Equity Ratio), 유동비율 (Current Ratio)
    - 재무 건전성, 자본 구조, 유동성 분석
    
    **Parameters:**
    - ticker: 종목 심볼 (예: "NVDA", "AAPL")
    - period: "annual" (연간) 또는 "quarter" (분기)
    - limit: 조회할 기간 수 (기본 5, 최대 12)
    
    **Returns:** List of balance sheets with total_assets, total_liabilities, 
    total_equity, cash, debt, and other financial position metrics.
    """

    normalized_period = (period or "annual").lower()
    if normalized_period == "quarterly":
        normalized_period = "quarter"
    if normalized_period not in {"annual", "quarter"}:
        raise ValueError("period 값은 'annual' 또는 'quarter'만 지원합니다.")

    # [FIX] Ensure limit is integer (AI may pass string from tool call)
    limit = int(limit) if limit else 5
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
            
            # [CRITICAL FIX] FMP API의 Equity 값이 부정확하므로 항상 계산으로 구함
            # 회계 방정식: Assets = Liabilities + Equity
            # → Equity = Assets - Liabilities
            
            if total_assets_val is not None and total_liab_val is not None:
                # 계산된 Equity 사용 (가장 정확)
                total_equity_val = total_assets_val - total_liab_val
                print(f"[BS] {ticker} {date_raw}: Equity = Assets - Liabilities = {total_assets_val} - {total_liab_val} = {total_equity_val}")
            else:
                # Fallback: FMP API 값 사용 (신뢰도 낮음)
                total_equity_val = (
                    item.get("totalStockholdersEquity") or
                    item.get("totalShareholderEquity") or
                    item.get("totalEquity") or
                    None
                )
                if total_equity_val:
                    print(f"[BS Warning] {ticker} {date_raw}: Using FMP Equity value (Assets/Liabilities missing): {total_equity_val}")
                else:
                    print(f"[BS Error] {ticker} {date_raw}: Cannot determine Equity (all fields missing)")

            # 각 항목을 개별적으로 처리하여 중복 키 에러 방지
            # Race condition 발생 시에도 안전하게 처리
            try:
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
                
                # 각 항목마다 즉시 커밋 (중복 에러 발생 시 해당 항목만 롤백)
                db.commit()
            except Exception as item_error:
                db.rollback()
                # 중복 키 에러인 경우 기존 레코드를 다시 조회하여 업데이트
                if "Duplicate entry" in str(item_error) or "uq_cbs" in str(item_error) or "_cbs_ticker_period_date_uc" in str(item_error):
                    print(f"[BS] Duplicate entry for {ticker} {report_date}, updating existing record...")
                    # 다시 조회 (다른 트랜잭션에서 삽입되었을 수 있음)
                    existing_retry = (
                        db.query(models.CompanyBalanceSheet)
                        .filter_by(
                            ticker=ticker,
                            period=normalized_period,
                            report_date=report_date
                        )
                        .first()
                    )
                    
                    if existing_retry:
                        # 기존 레코드 업데이트
                        existing_retry.report_year = _extract_year(item.get("calendarYear"), datetime.combine(report_date, datetime.min.time()))
                        existing_retry.total_assets = total_assets_val
                        existing_retry.total_current_assets = total_current_assets_val
                        existing_retry.total_liabilities = total_liab_val
                        existing_retry.total_current_liabilities = total_current_liab_val
                        existing_retry.total_noncurrent_liabilities = total_noncurrent_liab_val
                        existing_retry.total_equity = total_equity_val
                        existing_retry.cash_and_short_term_investments = item.get("cashAndShortTermInvestments") or item.get("cashAndCashEquivalents")
                        existing_retry.inventory = item.get("inventory")
                        existing_retry.accounts_receivable = item.get("netReceivables")
                        existing_retry.accounts_payable = item.get("accountPayables") or item.get("accountsPayables")
                        existing_retry.long_term_debt = item.get("longTermDebt")
                        existing_retry.short_term_debt = item.get("shortTermDebt")
                        db.commit()
                    else:
                        # 여전히 레코드를 찾을 수 없으면 에러 로그만 남기고 계속 진행
                        print(f"[BS Warning] Could not find or create record for {ticker} {report_date} after retry")
                else:
                    # 다른 종류의 에러는 로그만 남기고 계속 진행 (다른 항목 처리 계속)
                    print(f"[BS Error] Failed to process {ticker} {report_date}: {item_error}")

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

