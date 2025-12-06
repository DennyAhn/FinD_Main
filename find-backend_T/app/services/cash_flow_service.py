"""현금흐름표 데이터를 조회하고 저장하는 서비스."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

import httpx
from sqlalchemy.orm import Session

from app import models
from app.config import FMP_API_KEY, FMP_BASE_URL
from app.mcp.decorators import register_tool

CASH_FLOW_URL = f"{FMP_BASE_URL}/cash-flow-statement"
CACHE_TTL = timedelta(days=90)  # report_date 기준 3개월


def _extract_year(value: Any, fallback_date: datetime) -> int:
    if isinstance(value, int):
        return value
    if isinstance(value, str) and value.isdigit():
        return int(value)
    return fallback_date.year


@register_tool
async def fetch_company_cash_flows(
    ticker: str,
    db: Session,
    client: httpx.AsyncClient,
    period: str = "annual",
    limit: int = 5,
) -> Dict[str, Any]:
    """
    [AI용 설명] 특정 티커(ticker)의 현금흐름표 데이터를 조회하여 DB에 저장하고 반환합니다.
    
    period 파라미터:
    - "annual": 연간 데이터 (기본값, 최근 5개 연도)
    - "quarter": 분기별 데이터 (최근 8개 분기, 올해 분기 포함)
    
    반환값에는 운영현금흐름, 자유현금흐름, 투자현금흐름, 재무현금흐름과 함께
    현금 흐름 건강성에 대한 인사이트가 포함됩니다.
    """

    normalized_period = (period or "annual").lower()
    if normalized_period == "quarterly":
        normalized_period = "quarter"
    if normalized_period not in {"annual", "quarter"}:
        raise ValueError("period 값은 'annual' 또는 'quarter'만 지원합니다.")

    if limit:
        limit = int(limit)
    limit = max(1, min(limit, 12))

    latest_record = (
        db.query(models.CompanyCashFlow)
        .filter_by(ticker=ticker, period=normalized_period)
        .order_by(models.CompanyCashFlow.report_date.desc())
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
            f"{CASH_FLOW_URL}/{ticker}"
            f"?period={normalized_period}&limit={limit}&apikey={FMP_API_KEY}"
        )
        try:
            response = await client.get(url)
            response.raise_for_status()
            payload = response.json() or []

        except Exception as exc:
            print(f"fetch_company_cash_flows 호출 실패: {exc}")
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
                db.query(models.CompanyCashFlow)
                .filter_by(
                    ticker=ticker,
                    period=normalized_period,
                    report_date=report_date
                )
                .first()
            )

            if existing:
                # 기존 레코드 업데이트
                existing.report_year = _extract_year(
                    item.get("calendarYear"),
                    datetime.combine(report_date, datetime.min.time()),
                )
                existing.operating_cash_flow = item.get("netCashProvidedByOperatingActivities") or item.get("operatingCashFlow")
                existing.investing_cash_flow = item.get("netCashUsedForInvestingActivites") or item.get("investmentCashFlow")
                existing.financing_cash_flow = item.get("netCashUsedProvidedByFinancingActivities") or item.get("financingCashFlow")
                existing.capital_expenditure = item.get("capitalExpenditure")
                existing.free_cash_flow = item.get("freeCashFlow")
                # SBC, 자사주 매입, 배당도 함께 DB에 영구 저장
                existing.stock_based_compensation = item.get("stockBasedCompensation")
                existing.common_stock_repurchased = item.get("commonStockRepurchased")
                existing.dividends_paid = item.get("dividendsPaid")
            else:
                # 새 레코드 추가
                record = models.CompanyCashFlow(
                    ticker=ticker,
                    period=normalized_period,
                    report_date=report_date,
                    report_year=_extract_year(
                        item.get("calendarYear"),
                        datetime.combine(report_date, datetime.min.time()),
                    ),
                    operating_cash_flow=item.get("netCashProvidedByOperatingActivities")
                    or item.get("operatingCashFlow"),
                    investing_cash_flow=item.get("netCashUsedForInvestingActivites")
                    or item.get("investmentCashFlow"),
                    financing_cash_flow=item.get("netCashUsedProvidedByFinancingActivities")
                    or item.get("financingCashFlow"),
                    capital_expenditure=item.get("capitalExpenditure"),
                    free_cash_flow=item.get("freeCashFlow"),
                    stock_based_compensation=item.get("stockBasedCompensation"),
                    common_stock_repurchased=item.get("commonStockRepurchased"),
                    dividends_paid=item.get("dividendsPaid"),
                )
                db.add(record)
        db.commit()

    records = (
        db.query(models.CompanyCashFlow)
        .filter_by(ticker=ticker, period=normalized_period)
        .order_by(models.CompanyCashFlow.report_date.desc())
        .limit(limit)
        .all()
    )

    payload = [
        {
            "ticker": record.ticker,
            "period": record.period,
            "report_date": record.report_date.isoformat(),
            "report_year": record.report_year,
            "operating_cash_flow": record.operating_cash_flow,
            "investing_cash_flow": record.investing_cash_flow,
            "financing_cash_flow": record.financing_cash_flow,
            "capital_expenditure": record.capital_expenditure,
            "free_cash_flow": record.free_cash_flow,
            "stock_based_compensation": record.stock_based_compensation,
            "common_stock_repurchased": record.common_stock_repurchased,
            "dividends_paid": record.dividends_paid,
        }
        for record in records
    ]

    # --- 보조 데이터: 손익계산서(순이익, 매출) 및 SBC/자본 배치 맥락 ---
    income_summary: Dict[str, Any] = {}
    if records:
        latest_cf = records[0]
        try:
            income = (
                db.query(models.CompanyIncomeStatement)
                .filter_by(
                    ticker=ticker,
                    period=normalized_period,
                    report_date=latest_cf.report_date,
                )
                .first()
            )

            # 동일 날짜가 없으면 가장 최신 손익계산서로 대체
            if not income:
                income = (
                    db.query(models.CompanyIncomeStatement)
                    .filter_by(ticker=ticker, period=normalized_period)
                    .order_by(models.CompanyIncomeStatement.report_date.desc())
                    .first()
                )

            if income:
                income_summary = {
                    "net_income": income.net_income,
                    "revenue": income.revenue,
                }
        except Exception as exc:
            print(f"[Cash Flow] Income statement lookup failed: {exc}")
            income_summary = {}

    # --- 5. [NEW] Server-Driven UI Framework Integration ---
    from app.services.analyzers.cash_flow_analyzer import analyze_cash_flow
    from app.services.presenters.cash_flow_presenter import present_cash_flow

    # 1) Analyze
    # analyzer가 기대하는 포맷으로 데이터 구성
    analysis_input = {
        "cash_flows": payload,
        "income_summary": income_summary
    }
    analysis = analyze_cash_flow(analysis_input)
    
    # 2) Present (Generate Widgets)
    # AnalysisResult 객체 생성
    result_obj = present_cash_flow(ticker, normalized_period, analysis)
    
    # 3) Convert to Dict (for MCP Service)
    # Pydantic 모델을 dict로 변환하여 반환
    # 기존 데이터(records, income_summary)도 포함해야 함
    final_result = result_obj.model_dump()
    final_result["records"] = payload
    final_result["income_summary"] = income_summary
    
    return final_result

