"""현금흐름표(Cash Flow Statement) 뷰 위젯 생성 모듈."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List

import httpx
from sqlalchemy.orm import Session

from app.services.cash_flow_service import fetch_company_cash_flows

USD_TO_KRW = 1460


def _format_usd_krw_short(amount: float) -> Dict[str, str]:
    """USD 금액을 짧은 표기(USD) + 한화 서브 텍스트로 변환합니다."""
    try:
        value = float(amount or 0)
    except (TypeError, ValueError):
        value = 0.0

    abs_val = abs(value)
    if abs_val >= 1e12:
        main = f"${value / 1e12:.2f}T"
    elif abs_val >= 1e9:
        main = f"${value / 1e9:.2f}B"
    elif abs_val >= 1e6:
        main = f"${value / 1e6:.2f}M"
    else:
        main = f"${value / 1e3:.0f}K"

    won = value * USD_TO_KRW
    abs_won = abs(won)
    if abs_won >= 1e12:
        sub = f"≈{won / 1e12:.1f}조원"
    elif abs_won >= 1e8:
        sub = f"≈{won / 1e8:.1f}억원"
    else:
        sub = f"≈{won / 1e4:.0f}만원"

    return {"main": main, "sub": sub}
async def build_cash_flow_view(
    ticker: str,
    db: Session,
    client: httpx.AsyncClient,
    sub_tabs: List[Dict[str, Any]],
    period: str,
    year_range: int = 3,
) -> Dict[str, Any]:
    """
    현금흐름표 뷰 (Cash Flow) 위젯을 생성합니다.
    - Focus: 영업현금흐름, 투자/재무CF, 잉여현금흐름(FCF)
    """
    limit = 20 if period == "quarter" else 6

    cf_result = await fetch_company_cash_flows(ticker, db, client, period, limit)
    records = cf_result.get("records", []) if isinstance(cf_result, dict) else []

    if not records:
        return {
            "view_type": "financial_report",
            "sub_tabs": sub_tabs,
            "active_sub_tab": "cash_flow",
            "widgets": [],
        }

    sorted_records = sorted(records, key=lambda x: x.get("report_date", ""))
    if period == "quarter":
        quarters_to_keep = year_range * 4
        sorted_records = (
            sorted_records[-quarters_to_keep:]
            if len(sorted_records) > quarters_to_keep
            else sorted_records
        )

    latest = sorted_records[-1] if sorted_records else None
    prev = sorted_records[-2] if len(sorted_records) >= 2 else None

    highlights: List[str] = []
    metrics: List[Dict[str, Any]] = []

    if latest:
        ocf = latest.get("operating_cash_flow") or 0
        investing_cf = latest.get("investing_cash_flow") or 0
        financing_cf = latest.get("financing_cash_flow") or 0
        capex = latest.get("capital_expenditure")
        fcf = latest.get("free_cash_flow")

        if fcf is None and capex is not None:
            fcf = ocf - capex

        # 인사이트: 영업CF/FCF 상태
        if ocf > 0 and fcf is not None and fcf > 0:
            highlights.append(
                "영업활동으로 창출한 현금으로 투자와 재무활동을 충분히 커버하고 있습니다."
            )
        elif ocf > 0 and fcf is not None and fcf < 0:
            highlights.append(
                "영업현금흐름은 플러스지만 적극적인 투자/주주환원으로 잉여현금흐름이 마이너스입니다."
            )
        elif ocf < 0:
            highlights.append("영업현금흐름이 마이너스여서 현금 창출력에 유의가 필요합니다.")

        if prev:
            prev_fcf = prev.get("free_cash_flow")
            if prev_fcf is None and prev.get("capital_expenditure") is not None:
                prev_fcf = (prev.get("operating_cash_flow") or 0) - prev.get(
                    "capital_expenditure"
                )
            if fcf is not None and prev_fcf is not None and prev_fcf != 0:
                fcf_change = ((fcf - prev_fcf) / abs(prev_fcf)) * 100
                direction = "증가" if fcf_change > 0 else "감소"
                highlights.append(
                    f"잉여현금흐름(FCF)은 전년 대비 {fcf_change:+.1f}% {direction}했습니다."
                )

        if not highlights:
            highlights = ["현금흐름 데이터 분석 중..."]

        # 상단 메트릭: 숫자가 길기 때문에 짧은 USD + 한화 서브 텍스트로 표기
        ocf_fmt = _format_usd_krw_short(ocf)
        metrics.append(
            {
                "label": "영업현금흐름 (OCF)",
                "value": ocf_fmt["main"],
                "sub_text": ocf_fmt["sub"],
                "status": "good" if ocf > 0 else "bad",
            }
        )
        if fcf is not None:
            fcf_fmt = _format_usd_krw_short(fcf)
            metrics.append(
                {
                    "label": "잉여현금흐름 (FCF)",
                    "value": fcf_fmt["main"],
                    "sub_text": fcf_fmt["sub"],
                    "status": "good" if fcf > 0 else "bad",
                }
            )
        div = latest.get("dividends_paid") or 0
        buyback = latest.get("common_stock_repurchased") or 0
        shareholder_return = abs(div) + abs(buyback)
        sr_fmt = _format_usd_krw_short(shareholder_return)
        metrics.append(
            {
                "label": "주주환원 (배당+자사주)",
                "value": sr_fmt["main"],
                "sub_text": sr_fmt["sub"],
                "status": "neutral",
            }
        )

    insight_card = {
        "type": "insight_card",
        "title": "현금흐름 인사이트",
        "highlights": highlights,
        "metrics": metrics,
    }

    # 차트 데이터 (OCF, 투자CF, 재무CF + FCF 라인)
    chart_data: List[Dict[str, Any]] = []
    for rec in sorted_records:
        ocf = rec.get("operating_cash_flow") or 0
        investing_cf = rec.get("investing_cash_flow") or 0
        financing_cf = rec.get("financing_cash_flow") or 0
        capex = rec.get("capital_expenditure")
        fcf = rec.get("free_cash_flow")
        if fcf is None and capex is not None:
            fcf = ocf - capex

        if period == "annual":
            period_label = str(rec.get("report_year") or rec.get("report_date", "")[:4])
        else:
            report_date = rec.get("report_date", "")
            if report_date:
                year = report_date[:4]
                month = report_date[5:7] if len(report_date) >= 7 else ""
                period_str = rec.get("period", "")
                if "Q" in (period_str or "").upper():
                    quarter = (period_str or "").upper().split("Q")[-1].strip()[:1]
                elif month:
                    quarter = str((int(month) - 1) // 3 + 1)
                else:
                    quarter = "1"
                if month:
                    month_display = f"{int(month):02d}월"
                    period_label = f"{year} Q{quarter} ({month_display})"
                else:
                    period_label = f"{year} Q{quarter}"
            else:
                period_label = str(rec.get("report_year") or "")

        chart_data.append(
            {
                "period": period_label,
                "ocf": ocf,
                "investing_cf": investing_cf,
                "financing_cf": financing_cf,
                "fcf": fcf or 0,
            }
        )

    financial_chart = {
        "type": "financial_chart",
        "chart_type": "composed",
        "metric": "cash_flow",
        "x_key": "period",
        "series": [
            {
                "id": "ocf",
                "label": "영업CF",
                "type": "bar",
                "axis": "left",
                "color": "#22c55e",
                "value_key": "ocf",
            },
            {
                "id": "investing_cf",
                "label": "투자CF",
                "type": "bar",
                "axis": "left",
                "color": "#f97316",
                "value_key": "investing_cf",
            },
            {
                "id": "financing_cf",
                "label": "재무CF",
                "type": "bar",
                "axis": "left",
                "color": "#60a5fa",
                "value_key": "financing_cf",
            },
            {
                "id": "fcf",
                "label": "FCF",
                "type": "line",
                # FCF는 금액 단위이므로 다른 CF와 동일하게 좌측 축(USD) 사용
                "axis": "left",
                "color": "#e5e7eb",
                "value_key": "fcf",
            },
        ],
        "data": chart_data,
    }

    # 테이블 (간단 버전: OCF / 투자CF / 재무CF / FCF)
    table_rows: List[Dict[str, Any]] = []

    periods: List[str] = []
    max_periods = year_range * 4 if period == "quarter" else 5
    for rec in sorted_records[-max_periods:]:
        if period == "annual":
            period_label = str(rec.get("report_year") or rec.get("report_date", "")[:4])
        else:
            report_date = rec.get("report_date", "")
            if report_date:
                year = report_date[:4]
                month = report_date[5:7] if len(report_date) >= 7 else ""
                period_str = rec.get("period", "")
                if "Q" in (period_str or "").upper():
                    quarter = (period_str or "").upper().split("Q")[-1].strip()[:1]
                elif month:
                    quarter = str((int(month) - 1) // 3 + 1)
                else:
                    quarter = "1"
                if month:
                    month_display = f"{int(month):02d}월"
                    period_label = f"{year} Q{quarter} ({month_display})"
                else:
                    period_label = f"{year} Q{quarter}"
            else:
                period_label = str(rec.get("report_year") or "")
        if period_label not in periods:
            periods.append(period_label)

    periods.reverse()

    period_to_idx: Dict[str, int] = {}
    for idx, rec in enumerate(sorted_records):
        if period == "annual":
            period_label = str(rec.get("report_year") or rec.get("report_date", "")[:4])
        else:
            report_date = rec.get("report_date", "")
            if report_date:
                year = report_date[:4]
                month = report_date[5:7] if len(report_date) >= 7 else ""
                period_str = rec.get("period", "")
                if "Q" in (period_str or "").upper():
                    quarter = (period_str or "").upper().split("Q")[-1].strip()[:1]
                elif month:
                    quarter = str((int(month) - 1) // 3 + 1)
                else:
                    quarter = "1"
                if month:
                    month_display = f"{int(month):02d}월"
                    period_label = f"{year} Q{quarter} ({month_display})"
                else:
                    period_label = f"{year} Q{quarter}"
            else:
                period_label = str(rec.get("report_year") or "")
        period_to_idx[period_label] = idx

    def _cf_value_for(period_label: str, key: str) -> float:
        if period_label not in period_to_idx:
            return 0
        rec = sorted_records[period_to_idx[period_label]]
        return float(rec.get(key) or 0)

    ocf_row: Dict[str, Any] = {"id": "operating_cf", "label": "영업활동현금흐름 (OCF)"}
    investing_row: Dict[str, Any] = {
        "id": "investing_cf",
        "label": "투자활동현금흐름 (Investing CF)",
    }
    financing_row: Dict[str, Any] = {
        "id": "financing_cf",
        "label": "재무활동현금흐름 (Financing CF)",
    }
    fcf_row: Dict[str, Any] = {"id": "fcf", "label": "잉여현금흐름 (FCF)"}

    for p in periods:
        ocf_row[p] = _cf_value_for(p, "operating_cash_flow")
        investing_row[p] = _cf_value_for(p, "investing_cash_flow")
        financing_row[p] = _cf_value_for(p, "financing_cash_flow")

        fcf_val = _cf_value_for(p, "free_cash_flow")
        if not fcf_val:
            ocf_val = _cf_value_for(p, "operating_cash_flow")
            capex_val = _cf_value_for(p, "capital_expenditure")
            fcf_val = ocf_val - capex_val
        fcf_row[p] = fcf_val

    table_rows.extend([ocf_row, investing_row, financing_row, fcf_row])

    columns: List[Dict[str, Any]] = [
        {"key": "label", "label": "항목", "width": 260, "pin": "left"},
    ]
    for p in periods:
        columns.append({"key": p, "label": p, "format": "currency"})

    financial_table = {
        "type": "financial_table",
        "metric": "cash_flow",
        "period_type": period,
        "columns": columns,
        "rows": table_rows,
    }

    return {
        "view_type": "financial_report",
        "sub_tabs": sub_tabs,
        "active_sub_tab": "cash_flow",
        "as_of": datetime.utcnow().isoformat(),
        "currency": "USD",
        "widgets": [insight_card, financial_chart, financial_table],
    }


