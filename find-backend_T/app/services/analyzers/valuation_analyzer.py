from typing import Dict, Any, List, Optional

def analyze_valuation(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Valuation 데이터를 분석하여 점수와 상태, 인사이트를 도출합니다.
    
    Logic:
    1. PBR Trap Check: PBR이 높지만 ROE가 높으면 'High Efficiency'로 인정.
    2. PER Context: Forward PE와 Trailing PE 비교, 5년 평균 대비 괴리율.
    3. PEG Ratio: 성장성 대비 저평가 여부.
    """
    metrics_list = data.get("metrics", [])
    if not metrics_list:
        return {"score": 0, "status": "neutral", "insights": ["데이터가 부족합니다."]}

    latest = metrics_list[0]
    
    # --- 1. Extract Metrics ---
    pe = latest.get("pe_ratio")
    forward_pe = latest.get("forward_pe")
    pbr = latest.get("pb_ratio")
    roe = latest.get("return_on_equity")
    peg = latest.get("peg_ratio")
    
    # --- 2. Scoring Logic (0-100) ---
    score = 50  # Base Score
    insights = []
    badges = []

    # PER Analysis
    if pe and pe > 0:
        if pe < 15:
            score += 10
            insights.append(f"PER({pe:.1f})가 15 미만으로 저평가 구간입니다.")
        elif pe > 30:
            score -= 10
            insights.append(f"PER({pe:.1f})가 30 이상으로 고평가 부담이 있습니다.")
    
    # Forward PE Context
    if forward_pe and pe:
        if forward_pe < pe:
            score += 5
            insights.append("미래 실적 개선으로 PER 하락이 예상됩니다.")
        else:
            insights.append("미래 실적 둔화로 PER 상승이 우려됩니다.")

    # PBR Trap & Efficiency
    if pbr and roe:
        if pbr > 3.0:
            if roe > 0.20: # ROE 20% 이상
                score += 10
                badges.append("고효율")
                insights.append(f"PBR({pbr:.1f})이 높지만, ROE({roe*100:.1f}%)가 높아 정당화될 수 있습니다.")
            else:
                score -= 10
                insights.append(f"PBR({pbr:.1f})이 높고 ROE가 낮아 고평가 위험이 있습니다.")
        elif pbr < 1.0:
            score += 5
            badges.append("자산주")
            insights.append("PBR 1.0 미만으로 자산 가치 대비 저평가 상태입니다.")

    # PEG Analysis
    if peg:
        if 0 < peg < 1.0:
            score += 15
            badges.append("저평가 성장주")
            insights.append(f"PEG({peg:.2f})가 1 미만으로 성장성 대비 저평가입니다.")
        elif peg > 2.0:
            score -= 5
            insights.append(f"PEG({peg:.2f})가 2 이상으로 성장에 대한 프리미엄이 높습니다.")

    # Normalize Score
    score = max(0, min(100, score))
    
    # Determine Status
    if score >= 80: status = "good"
    elif score >= 50: status = "neutral"
    elif score >= 30: status = "warning"
    else: status = "bad"

    # --- 3. Historical Comparison (5yr Avg) ---
    def calculate_avg(key):
        values = [m.get(key) for m in metrics_list if m.get(key) is not None]
        if not values: return None
        return sum(values) / len(values)

    avg_pe = calculate_avg("pe_ratio")
    avg_pbr = calculate_avg("pb_ratio")
    avg_peg = calculate_avg("peg_ratio")

    return {
        "score": score,
        "status": status,
        "badges": badges,
        "insights": insights,
        "metrics": {
            "pe": pe,
            "avg_pe": avg_pe,
            "forward_pe": forward_pe,
            "pbr": pbr,
            "avg_pbr": avg_pbr,
            "roe": roe,
            "peg": peg,
            "avg_peg": avg_peg
        },
        "history": metrics_list  # For trend charts
    }
