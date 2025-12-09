from typing import Dict, Any, List, Optional

def analyze_valuation(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Valuation 데이터를 분석하여 점수와 상태, 인사이트를 도출합니다.
    (Professional GARP & Historical Mean Reversion Model)
    
    Logic:
    1. Historical PER Comparison: 과거 5년 평균 대비 현재 PER 위치 (Mean Reversion)
    2. PEG Ratio (GARP): 성장성(EPS Growth)을 감안한 적정 주가 판단
    3. PBR vs ROE: 고PBR을 고ROE가 정당화하는지 확인 (Quality Check)
    """
    metrics_list = data.get("metrics", [])
    if not metrics_list:
        return {"score": 0, "status": "neutral", "insights": ["데이터가 부족합니다."]}

    latest = metrics_list[0]
    
    # --- 1. Extract Metrics ---
    pe = latest.get("pe_ratio")
    forward_pe = latest.get("forward_pe")
    pbr = latest.get("price_to_book_ratio")
    roe = latest.get("return_on_equity")
    peg = latest.get("peg_ratio")
    
    # Service에서 계산된 평균값 가져오기
    avg_pe = latest.get("avg_pe")
    avg_pbr = latest.get("avg_pbr")
    avg_peg = latest.get("avg_peg")
    
    # --- 2. Scoring Logic (0-100) ---
    score = 50  # Base Score (Neutral Start)
    insights = []
    badges = []

    # [A] Historical PER Analysis (상대평가) - 가중치 30%
    if pe and avg_pe:
        # 평균 대비 -20% 이하면 저평가
        if pe < avg_pe * 0.8:
            score += 15
            insights.append(f"과거 5년 평균 PER({avg_pe:.1f}) 대비 저평가({pe:.1f}) 상태입니다.")
        # 평균 대비 +20% 이상이면 고평가
        elif pe > avg_pe * 1.2:
            score -= 15
            insights.append(f"과거 5년 평균 PER({avg_pe:.1f}) 대비 고평가({pe:.1f}) 부담이 있습니다.")
        else:
            score += 5 # 적정 범위
            insights.append(f"과거 5년 평균 밸류에이션({avg_pe:.1f})과 유사한 수준입니다.")
    else:
        # 데이터가 없으면 절대평가 (Legacy)
        if pe and pe < 15: score += 10
        elif pe and pe > 40: score -= 10 # 30->40으로 완화 (성장주 고려)

    # [B] PEG Ratio Analysis (성장성 평가) - 가중치 40% (가장 중요)
    if peg:
        if 0 < peg < 1.0:
            score += 25
            badges.append("저평가 성장주")
            insights.append(f"PEG({peg:.2f})가 1 미만으로, 높은 성장성이 고평가를 상쇄합니다.")
        elif 1.0 <= peg < 1.5:
            score += 10
            insights.append(f"PEG({peg:.2f})가 적정 수준(1.5 미만)으로 합리적인 가격대입니다.")
        elif peg > 2.5:
            score -= 15
            insights.append(f"PEG({peg:.2f})가 2.5를 초과하여 성장을 감안해도 비쌉니다.")

    # [C] Forward PE Trend (이익 전망) - 가중치 10%
    if forward_pe and pe:
        if forward_pe < pe * 0.9: # 10% 이상 하락 예상
            score += 10
            insights.append(f"내년 실적 개선으로 밸류에이션 부담 완화 예상 ({pe:.1f}x → {forward_pe:.1f}x)")
        elif forward_pe > pe * 1.1:
            score -= 10
            insights.append("내년 실적 둔화로 밸류에이션 부담 가중 우려")

    # [D] PBR & ROE Efficiency (Quality) - 가중치 20%
    if pbr and roe:
        roe_pct = roe * 100 if roe < 1 else roe # 0.2 -> 20.0 보정
        if roe_pct > 20.0:
            score += 10
            badges.append("고수익성")
            if pbr > 5.0:
                insights.append(f"높은 PBR({pbr:.1f})이지만 탁월한 수익성(ROE {roe_pct:.1f}%)이 뒷받침됩니다.")
        elif roe_pct < 5.0 and pbr > 1.5:
            score -= 10
            insights.append("수익성 대비 자산 가치가 고평가되어 있습니다.")
        
        # 저PBR 자산주 보너스
        if pbr < 1.0 and roe_pct > 8.0:
            score += 5
            badges.append("저평가 자산주")

    # Normalize Score
    score = max(10, min(95, score)) # 0이나 100은 잘 안 나오게
    
    # Determine Status
    if score >= 75: status = "good"     # 저평가/매력적
    elif score >= 45: status = "neutral" # 적정/보유
    elif score >= 30: status = "warning" # 주의
    else: status = "bad"                # 고평가/위험

    # 중복 제거 및 중요도 순 정렬
    insights = list(dict.fromkeys(insights))
    
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
