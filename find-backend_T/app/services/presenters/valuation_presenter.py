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

    # --- 2. Build Metrics List (Wall Street Standard: YoY + Historical Avg) ---
    val_metrics = []
    
    # PER
    pe = metrics.get("pe")
    avg_pe = metrics.get("avg_pe")
    pe_yoy_change = metrics.get("pe_ratio_yoy_change_pct")
    pe_previous = metrics.get("pe_ratio_previous")
    
    if pe:
        # Comparison: 5yr Avg + YoY Change
        comparison_parts = []
        if avg_pe:
            comparison_parts.append(f"vs 5yr Avg {avg_pe:.1f}x")
        if pe_yoy_change is not None and pe_previous:
            change_symbol = "↑" if pe_yoy_change > 0 else "↓" if pe_yoy_change < 0 else "→"
            comparison_parts.append(f"YoY {change_symbol}{abs(pe_yoy_change):.1f}% (전년 {pe_previous:.1f}x)")
        
        comparison = " | ".join(comparison_parts) if comparison_parts else None
        
        # Trend: YoY 기반 (더 정확)
        if pe_yoy_change is not None:
            trend = "down" if pe_yoy_change < -5 else "up" if pe_yoy_change > 5 else "flat"
        else:
            trend = "up" if avg_pe and pe > avg_pe else "down" if avg_pe and pe < avg_pe else "flat"
        
        val_metrics.append(ValuationMetric(
            label="PER",
            value=f"{pe:.1f}x",
            comparison=comparison,
            trend=trend,
            status="neutral"
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
    peg_yoy_change = metrics.get("peg_ratio_yoy_change_pct")
    peg_previous = metrics.get("peg_ratio_previous")
    
    if peg:
        # Comparison: 5yr Avg + YoY Change
        comparison_parts = []
        if avg_peg:
            comparison_parts.append(f"vs 5yr Avg {avg_peg:.2f}")
        if peg_yoy_change is not None and peg_previous:
            change_symbol = "↑" if peg_yoy_change > 0 else "↓" if peg_yoy_change < 0 else "→"
            comparison_parts.append(f"YoY {change_symbol}{abs(peg_yoy_change):.1f}% (전년 {peg_previous:.2f})")
        
        comparison = " | ".join(comparison_parts) if comparison_parts else None
        
        # Trend: YoY 기반
        if peg_yoy_change is not None:
            trend = "down" if peg_yoy_change < -10 else "up" if peg_yoy_change > 10 else "flat"
        else:
            trend = "flat"
        
        val_metrics.append(ValuationMetric(
            label="PEG",
            value=f"{peg:.2f}",
            comparison=comparison,
            trend=trend,
            status="good" if peg < 1.0 else "bad" if peg > 2.0 else "neutral"
        ))
        
    # PBR
    pbr = metrics.get("pbr")
    avg_pbr = metrics.get("avg_pbr")
    pbr_yoy_change = metrics.get("price_to_book_ratio_yoy_change_pct")
    pbr_previous = metrics.get("price_to_book_ratio_previous")
    
    if pbr:
        # Comparison: 5yr Avg + YoY Change
        comparison_parts = []
        if avg_pbr:
            comparison_parts.append(f"vs 5yr Avg {avg_pbr:.1f}x")
        if pbr_yoy_change is not None and pbr_previous:
            change_symbol = "↑" if pbr_yoy_change > 0 else "↓" if pbr_yoy_change < 0 else "→"
            comparison_parts.append(f"YoY {change_symbol}{abs(pbr_yoy_change):.1f}% (전년 {pbr_previous:.1f}x)")
        
        comparison = " | ".join(comparison_parts) if comparison_parts else None
        
        # Trend: YoY 기반
        if pbr_yoy_change is not None:
            trend = "down" if pbr_yoy_change < -5 else "up" if pbr_yoy_change > 5 else "flat"
        else:
            trend = "up" if avg_pbr and pbr > avg_pbr else "down" if avg_pbr and pbr < avg_pbr else "flat"
        
        val_metrics.append(ValuationMetric(
            label="PBR",
            value=f"{pbr:.1f}x",
            comparison=comparison,
            trend=trend,
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
