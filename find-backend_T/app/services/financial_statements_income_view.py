"""손익계산서(Incomes Statement) 뷰 위젯 생성 모듈."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List

import httpx
from sqlalchemy.orm import Session

from app.services.income_statement_service import fetch_company_income_statements


async def build_income_statement_view(
    ticker: str,
    db: Session,
    client: httpx.AsyncClient,
    sub_tabs: List[Dict[str, Any]],
    period: str,
    year_range: int = 3,
) -> Dict[str, Any]:
    # Fetch more data for quarters to support year_range filtering
    limit = 20 if period == "quarter" else 6
    statements = await fetch_company_income_statements(ticker, db, client, period, limit)
    if not statements:
        return {
            "view_type": "financial_report",
            "sub_tabs": sub_tabs,
            "active_sub_tab": "income",
            "widgets": [],
        }

    # Sort by date (ascending)
    sorted_statements = sorted(statements, key=lambda x: x.get("report_date", ""))

    # Filter by year_range for quarters
    if period == "quarter":
        # Keep only the last N quarters (1 year = 4 quarters, 2 years = 8 quarters, 3 years = 12 quarters)
        quarters_to_keep = year_range * 4
        sorted_statements = (
            sorted_statements[-quarters_to_keep:]
            if len(sorted_statements) > quarters_to_keep
            else sorted_statements
        )
    latest = sorted_statements[-1] if sorted_statements else None
    prev = sorted_statements[-2] if len(sorted_statements) >= 2 else None

    # Insight Card - Calculate metrics
    revenue_yoy = None
    revenue_qoq = None
    net_income_yoy = None
    net_income_qoq = None
    operating_margin = None

    if latest and prev:
        latest_revenue = latest.get("revenue") or 0
        prev_revenue = prev.get("revenue") or 0
        if prev_revenue > 0:
            change_pct = ((latest_revenue - prev_revenue) / prev_revenue) * 100
            if period == "annual":
                revenue_yoy = change_pct
            else:
                revenue_qoq = change_pct
                # Also calculate YoY if we have data from same quarter last year
                if len(sorted_statements) >= 5:
                    same_quarter_last_year = (
                        sorted_statements[-5] if len(sorted_statements) >= 5 else None
                    )
                    if same_quarter_last_year:
                        prev_year_revenue = same_quarter_last_year.get("revenue") or 0
                        if prev_year_revenue > 0:
                            revenue_yoy = (
                                (latest_revenue - prev_year_revenue) / prev_year_revenue
                            ) * 100

        latest_net = latest.get("net_income") or 0
        prev_net = prev.get("net_income") or 0
        if prev_net > 0:
            change_pct = ((latest_net - prev_net) / prev_net) * 100
            if period == "annual":
                net_income_yoy = change_pct
            else:
                net_income_qoq = change_pct
                # Also calculate YoY if we have data from same quarter last year
                if len(sorted_statements) >= 5:
                    same_quarter_last_year = (
                        sorted_statements[-5] if len(sorted_statements) >= 5 else None
                    )
                    if same_quarter_last_year:
                        prev_year_net = same_quarter_last_year.get("net_income") or 0
                        if prev_year_net > 0:
                            net_income_yoy = (
                                (latest_net - prev_year_net) / prev_year_net
                            ) * 100

        latest_revenue = latest.get("revenue") or 0
        latest_operating = latest.get("operating_income") or 0
        if latest_revenue > 0:
            operating_margin = (latest_operating / latest_revenue) * 100

    highlights: List[str] = []
    period_label = "연도" if period == "annual" else "분기"

    if revenue_yoy is not None:
        highlights.append(
            f"최근 {period_label} 매출은 전년 동기 대비 {revenue_yoy:+.1f}% "
            f"{'증가' if revenue_yoy > 0 else '감소'}했습니다."
        )
    if revenue_qoq is not None:
        highlights.append(
            f"전 분기 대비 매출은 {revenue_qoq:+.1f}% "
            f"{'증가' if revenue_qoq > 0 else '감소'}했습니다."
        )

    if net_income_yoy is not None:
        highlights.append(
            f"순이익은 전년 동기 대비 {net_income_yoy:+.1f}% "
            f"{'증가' if net_income_yoy > 0 else '감소'}했습니다."
        )
    if net_income_qoq is not None:
        highlights.append(
            f"전 분기 대비 순이익은 {net_income_qoq:+.1f}% "
            f"{'증가' if net_income_qoq > 0 else '감소'}했습니다."
        )

    if operating_margin is not None:
        highlights.append(f"영업이익률은 {operating_margin:.1f}%입니다.")

    if not highlights:
        highlights = ["재무 데이터 분석 중..."]

    # Build metrics array
    metrics: List[Dict[str, Any]] = []
    if revenue_yoy is not None:
        metrics.append(
            {
                "label": "매출 YoY",
                "value": f"{revenue_yoy:+.1f}%",
                "status": "good" if revenue_yoy > 0 else "bad" if revenue_yoy < 0 else "neutral",
            }
        )
    if revenue_qoq is not None:
        metrics.append(
            {
                "label": "매출 QoQ",
                "value": f"{revenue_qoq:+.1f}%",
                "status": "good" if revenue_qoq > 0 else "bad" if revenue_qoq < 0 else "neutral",
            }
        )
    if net_income_yoy is not None:
        metrics.append(
            {
                "label": "순이익 YoY",
                "value": f"{net_income_yoy:+.1f}%",
                "status": "good" if net_income_yoy > 0 else "bad" if net_income_yoy < 0 else "neutral",
            }
        )
    if net_income_qoq is not None:
        metrics.append(
            {
                "label": "순이익 QoQ",
                "value": f"{net_income_qoq:+.1f}%",
                "status": "good" if net_income_qoq > 0 else "bad" if net_income_qoq < 0 else "neutral",
            }
        )
    if operating_margin is not None:
        metrics.append(
            {
                "label": "영업이익률",
                "value": f"{operating_margin:.1f}%",
                "status": "neutral",
                "trend": "up" if operating_margin > 15 else "flat",
            }
        )

    insight_card = {
        "type": "insight_card",
        "title": "재무 요약 인사이트",
        "highlights": highlights,
        "metrics": metrics,
    }

    # Chart Data
    chart_data: List[Dict[str, Any]] = []
    for stmt in sorted_statements:
        revenue = stmt.get("revenue") or 0
        net_income = stmt.get("net_income") or 0
        net_margin = (net_income / revenue * 100) if revenue > 0 else 0

        # Format period label
        if period == "annual":
            p_label = str(stmt.get("report_year") or stmt.get("report_date", "")[:4])
        else:
            # For quarters: "2024 Q1 (03월)" format
            report_date = stmt.get("report_date", "")
            if report_date:
                year = report_date[:4]
                month = report_date[5:7] if len(report_date) >= 7 else ""
                # Try to extract quarter from period field or estimate from date
                period_str = stmt.get("period", "")
                if "Q" in (period_str or "").upper():
                    quarter = (period_str or "").upper().split("Q")[-1].strip()[:1]
                elif month:
                    quarter = str((int(month) - 1) // 3 + 1)
                else:
                    quarter = "1"

                # Format month display
                if month:
                    month_display = f"{int(month):02d}월"
                    p_label = f"{year} Q{quarter} ({month_display})"
                else:
                    p_label = f"{year} Q{quarter}"
            else:
                p_label = str(stmt.get("report_year") or "")

        chart_data.append(
            {
                "period": p_label,
                "revenue": revenue,
                "net_margin": net_margin,
            }
        )

    financial_chart = {
        "type": "financial_chart",
        "chart_type": "composed",
        "metric": "income",
        "x_key": "period",
        "series": [
            {
                "id": "revenue",
                "label": "Revenue",
                "type": "bar",
                "axis": "left",
                "color": "#34d399",
                "value_key": "revenue",
            },
            {
                "id": "net_margin",
                "label": "Net Margin",
                "type": "line",
                "axis": "right",
                "color": "#60a5fa",
                "value_key": "net_margin",
            },
        ],
        "data": chart_data,
    }

    # Table Data (Simplified - 실제로는 더 상세한 계층 구조 필요)
    table_rows: List[Dict[str, Any]] = []

    # Build period labels
    periods: List[str] = []
    max_periods = year_range * 4 if period == "quarter" else 5
    for stmt in sorted_statements[-max_periods:]:
        if period == "annual":
            p_label = str(stmt.get("report_year") or stmt.get("report_date", "")[:4])
        else:
            report_date = stmt.get("report_date", "")
            if report_date:
                year = report_date[:4]
                month = report_date[5:7] if len(report_date) >= 7 else ""
                period_str = stmt.get("period", "")
                if "Q" in (period_str or "").upper():
                    quarter = (period_str or "").upper().split("Q")[-1].strip()[:1]
                elif month:
                    quarter = str((int(month) - 1) // 3 + 1)
                else:
                    quarter = "1"

                if month:
                    month_display = f"{int(month):02d}월"
                    p_label = f"{year} Q{quarter} ({month_display})"
                else:
                    p_label = f"{year} Q{quarter}"
            else:
                p_label = str(stmt.get("report_year") or "")

        if p_label not in periods:
            periods.append(p_label)

    periods.reverse()  # Most recent first

    # Create a mapping from period label to statement index
    period_to_stmt: Dict[str, int] = {}
    for idx, stmt in enumerate(sorted_statements):
        if period == "annual":
            p_label = str(stmt.get("report_year") or stmt.get("report_date", "")[:4])
        else:
            report_date = stmt.get("report_date", "")
            if report_date:
                year = report_date[:4]
                month = report_date[5:7] if len(report_date) >= 7 else ""
                period_str = stmt.get("period", "")
                if "Q" in (period_str or "").upper():
                    quarter = (period_str or "").upper().split("Q")[-1].strip()[:1]
                elif month:
                    quarter = str((int(month) - 1) // 3 + 1)
                else:
                    quarter = "1"
                if month:
                    month_display = f"{int(month):02d}월"
                    p_label = f"{year} Q{quarter} ({month_display})"
                else:
                    p_label = f"{year} Q{quarter}"
            else:
                p_label = str(stmt.get("report_year") or "")
        period_to_stmt[p_label] = idx

    # Build table rows with professional terms
    table_rows.append(
        {
            "id": "revenue",
            "label": "매출액 (Revenue)",
            **{
                p: (sorted_statements[period_to_stmt[p]].get("revenue") or 0)
                if p in period_to_stmt
                else 0
                for p in periods
            },
        }
    )
    table_rows.append(
        {
            "id": "gross_profit",
            "label": "매출총이익 (Gross Profit)",
            **{
                p: (sorted_statements[period_to_stmt[p]].get("gross_profit") or 0)
                if p in period_to_stmt
                else 0
                for p in periods
            },
        }
    )
    table_rows.append(
        {
            "id": "operating_income",
            "label": "영업이익 (Operating Income)",
            **{
                p: (sorted_statements[period_to_stmt[p]].get("operating_income") or 0)
                if p in period_to_stmt
                else 0
                for p in periods
            },
        }
    )
    table_rows.append(
        {
            "id": "net_income",
            "label": "당기순이익 (Net Income)",
            **{
                p: (sorted_statements[period_to_stmt[p]].get("net_income") or 0)
                if p in period_to_stmt
                else 0
                for p in periods
            },
        }
    )
    # 순이익률(Net Margin) 행 추가 (당기순이익 / 매출액)
    net_margin_row: Dict[str, Any] = {
        "id": "net_margin",
        "label": "순이익률 (Net Margin)",
    }
    for p in periods:
        if p in period_to_stmt:
            stmt = sorted_statements[period_to_stmt[p]]
            rev = stmt.get("revenue") or 0
            net = stmt.get("net_income") or 0
            net_margin_row[p] = (net / rev) if rev > 0 else 0  # 0.123 → 12.3%
        else:
            net_margin_row[p] = 0
    table_rows.append(net_margin_row)

    columns: List[Dict[str, Any]] = [
        {"key": "label", "label": "항목", "width": 260, "pin": "left"},
    ]
    for p in periods:
        columns.append({"key": p, "label": p, "format": "currency"})

    financial_table = {
        "type": "financial_table",
        "metric": "income",
        "period_type": period,
        "columns": columns,
        "rows": table_rows,
    }

    return {
        "view_type": "financial_report",
        "sub_tabs": sub_tabs,
        "active_sub_tab": "income",
        "as_of": datetime.utcnow().isoformat(),
        "currency": "USD",
        "widgets": [insight_card, financial_chart, financial_table],
    }


