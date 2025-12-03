from typing import Dict, Any, List

def analyze_cash_flow(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Cash Flow 데이터를 분석하여 현금 흐름의 질과 자본 배분 정책을 평가합니다.
    
    Logic:
    1. Quality Check: OCF > Net Income (Conversion Ratio), FCF Margin.
    2. Capital Allocation: Shareholder Yield (Buyback + Dividend) vs Capex.
    """
    cf_list = data.get("cash_flows", [])
    income_summary = data.get("income_summary", {})
    
    if not cf_list:
        return {"score": 0, "status": "neutral", "insights": ["현금흐름 데이터가 없습니다."]}

    latest_cf = cf_list[0]
    
    # --- 1. Extract Metrics ---
    ocf = latest_cf.get("operating_cash_flow") or 0
    fcf = latest_cf.get("free_cash_flow") or 0
    capex = abs(latest_cf.get("capital_expenditure") or 0)
    
    # Capital Allocation
    buyback = abs(latest_cf.get("common_stock_repurchased") or 0)
    dividend = abs(latest_cf.get("dividends_paid") or 0)
    sbc = latest_cf.get("stock_based_compensation") or 0
    
    # Income (for margins)
    net_income = income_summary.get("net_income") or 0
    revenue = income_summary.get("revenue") or 0

    # --- 2. Analysis Logic ---
    score = 50
    insights = []
    badges = []

    # Quality Check (OCF vs Net Income)
    if net_income > 0:
        conversion_ratio = ocf / net_income
        if conversion_ratio > 1.0:
            score += 10
            badges.append("현금창출력 우수")
            insights.append(f"영업현금흐름이 순이익보다 {conversion_ratio:.1f}배 많아 이익의 질이 높습니다.")
        elif conversion_ratio < 0.8:
            score -= 10
            insights.append("순이익 대비 현금 유입이 적어 이익의 질을 점검해야 합니다.")

    # FCF Margin
    if revenue > 0:
        fcf_margin = fcf / revenue
        if fcf_margin > 0.20:
            score += 10
            badges.append("Cash Cow")
            insights.append(f"매출의 {fcf_margin*100:.1f}%가 잉여현금으로 남는 고수익 구조입니다.")

    # Shareholder Return
    total_return = buyback + dividend
    if total_return > 0:
        score += 10
        badges.append("주주친화")
        insights.append("자사주 매입과 배당으로 주주 환원에 적극적입니다.")
        
        # SBC Check (Dilution Risk)
        if sbc > buyback:
            score -= 5
            insights.append("자사주 매입보다 주식 보상 비용(SBC)이 커서 주주 가치 희석 우려가 있습니다.")

    # Normalize Score
    score = max(0, min(100, score))
    
    if score >= 80: status = "good"
    elif score >= 50: status = "neutral"
    elif score >= 30: status = "warning"
    else: status = "bad"

    return {
        "score": score,
        "status": status,
        "badges": badges,
        "insights": insights,
        "metrics": {
            "ocf": ocf,
            "fcf": fcf,
            "capex": capex,
            "buyback": buyback,
            "dividend": dividend,
            "sbc": sbc,
            "net_income": net_income,
            "revenue": revenue
        },
        "history": cf_list
    }
