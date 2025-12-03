from typing import Dict, Any, List
from app.services.framework import AnalysisResult, AnalysisMeta, AnalysisHeader, ComprehensiveValuationWidget, ValuationMetric

def present_valuation(ticker: str, period: str, analysis: Dict[str, Any]) -> AnalysisResult:
    """
    Valuation 분석 결과를 Server-Driven UI 위젯으로 변환합니다.
    """
    score = analysis.get("score", 0)
    status = analysis.get("status", "neutral")
    badges = analysis.get("badges", [])
    insights = analysis.get("insights", [])
    metrics = analysis.get("metrics", {})
    
    # --- 1. Header ---
    header = AnalysisHeader(
        status=status,
        score=score,
        title=f"{ticker} 밸류에이션 분석",
        badges=badges
    )

    # --- 2. Build Metrics List ---
    val_metrics = []
    
    # PER
    pe = metrics.get("pe")
    avg_pe = metrics.get("avg_pe")
    if pe:
        comparison = f"vs 5yr Avg {avg_pe:.1f}x" if avg_pe else None
        trend = "up" if avg_pe and pe > avg_pe else "down" if avg_pe and pe < avg_pe else "flat"
        val_metrics.append(ValuationMetric(
            label="PER",
            value=f"{pe:.1f}x",
            comparison=comparison,
            trend=trend,
            status="neutral" # TODO: logic
        ))

    # Forward PER
    fwd_pe = metrics.get("forward_pe")
    if fwd_pe:
        val_metrics.append(ValuationMetric(
            label="Fwd PER",
            value=f"{fwd_pe:.1f}x",
            comparison=None,
            trend="flat",
            status="good" if pe and fwd_pe < pe else "neutral"
        ))

    # PEG
    peg = metrics.get("peg")
    avg_peg = metrics.get("avg_peg")
    if peg:
        comparison = f"vs 5yr Avg {avg_peg:.2f}" if avg_peg else None
        val_metrics.append(ValuationMetric(
            label="PEG",
            value=f"{peg:.2f}",
            comparison=comparison,
            status="good" if peg < 1.0 else "bad" if peg > 2.0 else "neutral"
        ))
        
    # PBR
    pbr = metrics.get("pbr")
    avg_pbr = metrics.get("avg_pbr")
    if pbr:
        comparison = f"vs 5yr Avg {avg_pbr:.1f}x" if avg_pbr else None
        val_metrics.append(ValuationMetric(
            label="PBR",
            value=f"{pbr:.1f}x",
            comparison=comparison,
            status="neutral"
        ))

    # --- 3. Comprehensive Widget ---
    # 요약 텍스트 생성
    summary_text = ""
    if insights:
        summary_text = insights[0] # 첫 번째 인사이트를 메인 요약으로 사용

    comp_widget = ComprehensiveValuationWidget(
        ticker=ticker,
        price="-", # TODO: Quote data needed in presenter or passed from service
        change="-",
        badges=badges,
        score=score,
        status=status,
        summary=summary_text,
        metrics=val_metrics
    )

    return AnalysisResult(
        meta=AnalysisMeta(ticker=ticker, period=period),
        header=header,
        widgets=[comp_widget]
    )
