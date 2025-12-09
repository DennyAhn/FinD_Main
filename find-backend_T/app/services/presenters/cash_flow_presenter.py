from typing import Dict, Any, List
from app.services.framework import AnalysisResult, AnalysisMeta, AnalysisHeader, SparklineCard, DonutChart, MarkdownText

def present_cash_flow(ticker: str, period: str, analysis: Dict[str, Any]) -> AnalysisResult:
    """
    Cash Flow 분석 결과를 Server-Driven UI 위젯으로 변환합니다.
    """
    score = analysis.get("score", 0)
    status = analysis.get("status", "neutral")
    badges = analysis.get("badges", [])
    insights = analysis.get("insights", [])
    metrics = analysis.get("metrics", {})
    history = analysis.get("history", [])

    # --- 1. Header ---
    header = AnalysisHeader(
        status=status,
        score=score,
        title=f"{ticker} 현금흐름 분석",
        badges=badges
    )

    # --- 2. Widgets ---
    widgets = []

    # A. FCF Trend (Sparkline)
    fcf_trend = [c.get("free_cash_flow") for c in history if c.get("free_cash_flow") is not None]
    fcf_trend.reverse()
    
    # 단위 변환 (Billion)
    fcf_val = metrics.get("fcf", 0)
    fcf_str = f"${fcf_val / 1e9:.1f}B" if abs(fcf_val) >= 1e9 else f"${fcf_val / 1e6:.1f}M"

    widgets.append(SparklineCard(
        label="Free Cash Flow",
        value=fcf_str,
        trend_history=fcf_trend,
        status="good" if fcf_val > 0 else "bad"
    ))

    # B. Capital Allocation (Donut Chart)
    # Buyback vs Dividend vs Capex
    buyback = metrics.get("buyback", 0)
    dividend = metrics.get("dividend", 0)
    capex = metrics.get("capex", 0)
    
    total_alloc = buyback + dividend + capex
    
    if total_alloc > 0:
        segments = []
        if buyback > 0:
            segments.append({"label": "Buyback", "value": buyback, "color": "#8884d8"}) # Purple
        if dividend > 0:
            segments.append({"label": "Dividend", "value": dividend, "color": "#82ca9d"}) # Green
        if capex > 0:
            segments.append({"label": "Capex", "value": capex, "color": "#ffc658"}) # Yellow
            
        widgets.append(DonutChart(
            segments=segments,
            total_label="Total Allocation",
            total_value=f"${total_alloc / 1e9:.1f}B"
        ))

    # C. Insight Text
    # [REMOVED] MarkdownText 위젯 중복 출력 방지
    # AI가 insights 데이터를 보고 자연스럽게 텍스트로 설명하도록 맡김
    # if insights:
    #     md_content = "### 💡 Cash Flow Insights\n"
    #     for insight in insights:
    #         md_content += f"- {insight}\n"
    #     
    #     widgets.append(MarkdownText(content=md_content))

    return AnalysisResult(
        meta=AnalysisMeta(ticker=ticker, period=period),
        header=header,
        widgets=widgets
    )
