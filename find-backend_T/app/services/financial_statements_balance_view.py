"""재무상태표(Balance Sheet) 뷰 위젯 생성 모듈."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

import httpx
from sqlalchemy.orm import Session

from app import models
from app.services.balance_sheet_service import fetch_company_balance_sheets

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
async def build_balance_sheet_view(
    ticker: str,
    db: Session,
    client: httpx.AsyncClient,
    sub_tabs: List[Dict[str, Any]],
    period: str,
    year_range: int = 3,
) -> Dict[str, Any]:
    """
    재무상태표 뷰 (Balance Sheet) 위젯을 생성합니다.
    - Focus: 재무 건전성(부채비율, 유동비율) & 자산/부채/자본 구조
    """
    # 1) 데이터 조회
    limit = 20 if period == "quarter" else 6
    records = await fetch_company_balance_sheets(ticker, db, client, period, limit)
    if not records:
        return {
            "view_type": "financial_report",
            "sub_tabs": sub_tabs,
            "active_sub_tab": "balance",
            "widgets": [],
        }

    # 2) 날짜 오름차순 정렬
    sorted_records = sorted(records, key=lambda x: x.get("report_date", ""))

    # 분기 데이터인 경우 year_range에 맞게 최근 N개만 사용
    if period == "quarter":
        quarters_to_keep = year_range * 4
        sorted_records = (
            sorted_records[-quarters_to_keep:]
            if len(sorted_records) > quarters_to_keep
            else sorted_records
        )

    latest = sorted_records[-1] if sorted_records else None
    prev = sorted_records[-2] if len(sorted_records) >= 2 else None

    # 3) 인사이트 카드 계산
    highlights: List[str] = []
    metrics: List[Dict[str, Any]] = []

    de_ratio: Optional[float] = None
    current_ratio: Optional[float] = None
    cash_yoy: Optional[float] = None

    if latest:
        total_assets = latest.get("total_assets") or 0
        total_liabilities = latest.get("total_liabilities") or 0
        raw_equity = latest.get("total_equity")
        # total_equity가 비어 있으면 자산-부채로 보정 (연/분기 공통)
        if (
            raw_equity is None
            and latest.get("total_assets") is not None
            and latest.get("total_liabilities") is not None
        ):
            total_equity = (latest.get("total_assets") or 0) - (
                latest.get("total_liabilities") or 0
            )
        else:
            total_equity = raw_equity or 0

        # 유동자산: total_current_assets가 있으면 1순위로 사용, 없으면 (현금+재고+매출채권) 근사치
        # cash_yoy 계산을 위해 현금성 자산은 별도 변수로 보관
        cash_like_latest = latest.get("cash_and_short_term_investments") or 0
        current_assets = latest.get("total_current_assets")
        if current_assets is None:
            inventory = latest.get("inventory") or 0
            ar = latest.get("accounts_receivable") or 0
            current_assets = cash_like_latest + inventory + ar

        # FMP에서 totalCurrentLiabilities가 내려오면 이를 1순위로 사용
        current_liabilities = latest.get("total_current_liabilities")
        if current_liabilities is None:
            ap = latest.get("accounts_payable") or 0
            short_term_debt = latest.get("short_term_debt") or 0
            current_liabilities = ap + short_term_debt

        if total_equity and total_equity > 0:
            de_ratio = (total_liabilities / total_equity) * 100  # % 스케일
        if current_liabilities and current_liabilities > 0:
            current_ratio = (current_assets / current_liabilities) * 100  # % 스케일

        # --- FMP Key Metrics 기준 "정식" 부채비율/유동비율 (항상 최신 분기 기준 사용) ---
        try:
            metrics_row = (
                db.query(models.CompanyKeyMetrics)
                .filter_by(ticker=ticker, period="quarter")
                .order_by(models.CompanyKeyMetrics.report_date.desc())
                .first()
            )
        except Exception:
            metrics_row = None

        # metrics_row의 비율은 FMP에서 내려오는 배수(예: 0.09 = 9%)이므로,
        # 차트용 de_ratio/current_ratio는 여전히 % 스케일, 메트릭 카드에는 배수(x)로 사용.
        de_ratio_multiple: Optional[float] = None
        current_ratio_multiple: Optional[float] = None

        if metrics_row:
            if metrics_row.current_ratio is not None:
                current_ratio_multiple = float(metrics_row.current_ratio)
                current_ratio = current_ratio_multiple * 100.0
            if metrics_row.debt_to_equity is not None:
                de_ratio_multiple = float(metrics_row.debt_to_equity)
                de_ratio = de_ratio_multiple * 100.0

        if prev:
            prev_cash = prev.get("cash_and_short_term_investments") or 0
            if prev_cash > 0:
                cash_yoy = ((cash_like_latest - prev_cash) / prev_cash) * 100

        # 하이라이트 문장 생성
        if de_ratio is not None:
            if de_ratio < 50:
                highlights.append(f"부채비율은 {de_ratio:.1f}%로 매우 건전한 수준입니다.")
            elif de_ratio < 100:
                highlights.append(f"부채비율은 {de_ratio:.1f}%로 적정 수준입니다.")
            else:
                highlights.append(f"부채비율은 {de_ratio:.1f}%로 레버리지 비중이 높은 편입니다.")

        if current_ratio is not None:
            if current_ratio >= 150:
                highlights.append(
                    f"유동비율이 {current_ratio:.1f}%로 단기 채무 상환 여력이 충분합니다."
                )
            elif current_ratio >= 100:
                highlights.append(
                    f"유동비율이 {current_ratio:.1f}%로 무난한 수준입니다."
                )
            else:
                highlights.append(
                    f"유동비율이 {current_ratio:.1f}%로 단기 유동성에 주의가 필요합니다."
                )

        if cash_yoy is not None:
            direction = "증가" if cash_yoy > 0 else "감소"
            highlights.append(
                f"현금및단기투자 자산은 전년 동기 대비 {cash_yoy:+.1f}% {direction}했습니다."
            )

        if not highlights:
            highlights = ["재무 상태 분석 중..."]

        # 메트릭 카드 (표시용 값은 배수 기준으로 표기)
        if de_ratio is not None:
            status = "good" if de_ratio < 60 else "neutral" if de_ratio < 100 else "warning"
            if de_ratio_multiple is not None:
                de_value_str = f"{de_ratio_multiple:.2f}x"
            else:
                de_value_str = f"{de_ratio:.1f}%"
            metrics.append(
                {
                    "label": "부채비율 (Debt to Equity)",
                    "value": de_value_str,
                    "status": status,
                }
            )
        if current_ratio is not None:
            status = (
                "good" if current_ratio >= 150 else "neutral" if current_ratio >= 100 else "warning"
            )
            if current_ratio_multiple is not None:
                cr_value_str = f"{current_ratio_multiple:.2f}x"
            else:
                cr_value_str = f"{current_ratio:.1f}%"
            metrics.append(
                {
                    "label": "유동비율 (Current Ratio)",
                    "value": cr_value_str,
                    "status": status,
                }
            )
        # 총자산은 숫자가 길기 때문에 짧은 USD + 한화 서브 텍스트로 표기
        assets_fmt = _format_usd_krw_short(total_assets or 0)
        metrics.append(
            {
                "label": "총자산 (Total Assets)",
                "value": assets_fmt["main"],
                "sub_text": assets_fmt["sub"],
                "status": "neutral",
            }
        )

    insight_card = {
        "type": "insight_card",
        "title": "재무 구조 인사이트",
        "highlights": highlights,
        "metrics": metrics,
    }

    # 4) 차트 데이터 (자산/부채/자본 구조 + 부채비율)
    chart_data: List[Dict[str, Any]] = []
    for rec in sorted_records:
        total_assets = rec.get("total_assets") or 0
        total_liabilities = rec.get("total_liabilities") or 0
        raw_equity = rec.get("total_equity")
        if raw_equity is None and rec.get("total_assets") is not None and rec.get("total_liabilities") is not None:
            total_equity = (rec.get("total_assets") or 0) - (rec.get("total_liabilities") or 0)
        else:
            total_equity = raw_equity or 0

        # 유동자산: total_current_assets 우선 사용
        current_assets = rec.get("total_current_assets")
        if current_assets is None:
            cash_like = rec.get("cash_and_short_term_investments") or 0
            inventory = rec.get("inventory") or 0
            ar = rec.get("accounts_receivable") or 0
            current_assets = cash_like + inventory + ar
        # 비유동자산: 총자산 - 유동자산
        noncurrent_assets = total_assets - current_assets

        # 유동부채: totalCurrentLiabilities가 있으면 그대로 사용, 없으면 AP+단기차입 근사
        current_liabilities = rec.get("total_current_liabilities")
        if current_liabilities is None:
            ap = rec.get("accounts_payable") or 0
            short_term_debt = rec.get("short_term_debt") or 0
            current_liabilities = ap + short_term_debt
        # 비유동부채: totalNonCurrentLiabilities 우선, 없으면 총부채-유동부채로 추정
        noncurrent_liabilities = rec.get("total_noncurrent_liabilities")
        if noncurrent_liabilities is None:
            noncurrent_liabilities = total_liabilities - current_liabilities

        if total_equity and total_equity > 0:
            de_ratio_point = (total_liabilities / total_equity) * 100
        else:
            de_ratio_point = 0

        # 기간 라벨
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
                "current_assets": current_assets,
                "noncurrent_assets": noncurrent_assets,
                "current_liabilities": current_liabilities,
                "noncurrent_liabilities": noncurrent_liabilities,
                "equity": total_equity,
                "de_ratio": de_ratio_point,
            }
        )

    financial_chart = {
        "type": "financial_chart",
        "chart_type": "stacked",
        "metric": "balance",
        "x_key": "period",
        "series": [
            {
                "id": "current_assets",
                "label": "유동자산",
                "type": "bar",
                "axis": "left",
                "color": "#60a5fa",
                "value_key": "current_assets",
            },
            {
                "id": "noncurrent_assets",
                "label": "비유동자산",
                "type": "bar",
                "axis": "left",
                "color": "#1d4ed8",
                "value_key": "noncurrent_assets",
            },
            {
                "id": "current_liabilities",
                "label": "유동부채",
                "type": "bar",
                "axis": "left",
                "color": "#f97316",
                "value_key": "current_liabilities",
            },
            {
                "id": "noncurrent_liabilities",
                "label": "비유동부채",
                "type": "bar",
                "axis": "left",
                "color": "#ea580c",
                "value_key": "noncurrent_liabilities",
            },
            {
                "id": "equity",
                "label": "자기자본",
                "type": "bar",
                "axis": "left",
                "color": "#22c55e",
                "value_key": "equity",
            },
            {
                "id": "de_ratio",
                "label": "부채비율",
                "type": "line",
                "axis": "right",
                "color": "#e5e7eb",
                "value_key": "de_ratio",
            },
        ],
        "data": chart_data,
    }

    # 5) 테이블 데이터 (자산/부채/자본 트리 구조)
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

    def _value_for(period_label: str, key: str) -> float:
        if period_label not in period_to_idx:
            return 0
        rec = sorted_records[period_to_idx[period_label]]
        # total_equity가 None인 경우 자산-부채로 보정 (과거 저장분까지 커버)
        if key == "total_equity":
            raw_equity = rec.get("total_equity")
            if raw_equity is None and rec.get("total_assets") is not None and rec.get("total_liabilities") is not None:
                return float((rec.get("total_assets") or 0) - (rec.get("total_liabilities") or 0))
        return float(rec.get(key) or 0)

    # 자산 블록
    assets_row: Dict[str, Any] = {"id": "assets", "label": "자산 (Assets)"}
    for p in periods:
        assets_row[p] = _value_for(p, "total_assets")

    current_assets_row: Dict[str, Any] = {
        "id": "current_assets",
        "label": "유동성 자산(현금+재고+매출채권)",
    }
    noncurrent_assets_row: Dict[str, Any] = {
        "id": "noncurrent_assets",
        "label": "비유동자산 (추정)",
    }

    for p in periods:
        # 유동자산: total_current_assets 우선, 없으면 (현금+재고+매출채권) 근사
        curr = _value_for(p, "total_current_assets")
        if not curr:
            cash_like = _value_for(p, "cash_and_short_term_investments")
            inventory = _value_for(p, "inventory")
            ar_val = _value_for(p, "accounts_receivable")
            curr = cash_like + inventory + ar_val
        total = _value_for(p, "total_assets")
        current_assets_row[p] = curr
        noncurrent_assets_row[p] = max(0.0, total - curr)

    assets_row["children"] = [current_assets_row, noncurrent_assets_row]
    table_rows.append(assets_row)

    # 부채 블록
    liab_row: Dict[str, Any] = {"id": "liabilities", "label": "부채 (Liabilities)"}
    for p in periods:
        liab_row[p] = _value_for(p, "total_liabilities")

    current_liab_row: Dict[str, Any] = {
        "id": "current_liabilities",
        "label": "유동부채 (Current Liabilities)",
    }
    noncurrent_liab_row: Dict[str, Any] = {
        "id": "noncurrent_liabilities",
        "label": "비유동부채 (추정)",
    }

    for p in periods:
        # 유동부채: total_current_liabilities 우선, 없으면 AP+단기차입 근사
        curr_l = _value_for(p, "total_current_liabilities")
        if not curr_l:
            ap_val = _value_for(p, "accounts_payable")
            std = _value_for(p, "short_term_debt")
            curr_l = ap_val + std
        total_l = _value_for(p, "total_liabilities")
        # 비유동부채: total_noncurrent_liabilities 우선, 없으면 총부채-유동부채
        noncurr_l = _value_for(p, "total_noncurrent_liabilities")
        if not noncurr_l and total_l:
            noncurr_l = max(0.0, total_l - curr_l)
        current_liab_row[p] = curr_l
        noncurrent_liab_row[p] = noncurr_l

    liab_row["children"] = [current_liab_row, noncurrent_liab_row]
    table_rows.append(liab_row)

    # 자본
    equity_row: Dict[str, Any] = {"id": "equity", "label": "자본 (Shareholders' Equity)"}
    for p in periods:
        equity_row[p] = _value_for(p, "total_equity")
    table_rows.append(equity_row)

    columns: List[Dict[str, Any]] = [
        {"key": "label", "label": "항목", "width": 260, "pin": "left"},
    ]
    for p in periods:
        columns.append({"key": p, "label": p, "format": "currency"})

    financial_table = {
        "type": "financial_table",
        "metric": "balance",
        "period_type": period,
        "columns": columns,
        "rows": table_rows,
    }

    return {
        "view_type": "financial_report",
        "sub_tabs": sub_tabs,
        "active_sub_tab": "balance",
        "as_of": datetime.utcnow().isoformat(),
        "currency": "USD",
        "widgets": [insight_card, financial_chart, financial_table],
    }


