from typing import List, Optional, Union, Any, Literal, Dict
from pydantic import BaseModel, Field

# --- Widget Models ---

class Widget(BaseModel):
    """모든 위젯의 기본 클래스"""
    type: str
    title: Optional[str] = None
    description: Optional[str] = None

class GaugeChart(Widget):
    """
    ECharts Gauge Chart 위젯
    - min, max: 게이지 범위
    - value: 현재 값
    - average: 업계/과거 평균 (선택)
    - color: 게이지 색상 (green, yellow, red 등)
    """
    type: Literal["gauge_chart"] = "gauge_chart"
    min: float = 0.0
    max: float = 100.0
    value: float
    average: Optional[float] = None
    color: str = "blue"  # hex code or preset name
    label: str  # e.g., "Valuation Score"

class SparklineCard(Widget):
    """
    Recharts Sparkline Card 위젯
    - label: 지표 이름 (e.g., "Forward PE")
    - value: 현재 값 (문자열 포맷팅 포함, e.g., "15.4x")
    - trend_history: List[float]
    - change: 전년/전분기 대비 변화량 (문자열, e.g., "+5.2%")
    - status: 상태 (good, bad, neutral)
    """
    type: Literal["sparkline_card"] = "sparkline_card"
    label: str
    value: Union[str, float]
    trend_history: List[float]
    change: Optional[str] = None
    status: Literal["good", "bad", "neutral"] = "neutral"

class DonutChart(Widget):
    """
    Shareholder Yield 등을 표현하기 위한 Donut Chart
    - segments: {label: str, value: float, color: str} 리스트
    - total_label: 중앙에 표시할 텍스트 (e.g., "Total Yield")
    - total_value: 중앙에 표시할 값 (e.g., "5.4%")
    """
    type: Literal["donut_chart"] = "donut_chart"
    segments: List[Dict[str, Any]]  # [{"label": "Dividend", "value": 1.5, "color": "#..."}, ...]
    total_label: Optional[str] = None
    total_value: Optional[str] = None

class DataTable(Widget):
    """
    분기별 데이터 등을 보여주는 테이블 위젯
    - columns: 컬럼 정의 [{"key": "date", "label": "Date"}, ...]
    - rows: 데이터 리스트
    """
    type: Literal["data_table"] = "data_table"
    columns: List[Dict[str, str]]
    rows: List[Dict[str, Any]]

class MarkdownText(Widget):
    """
    텍스트 기반 인사이트나 뉴스 요약 위젯
    """
    type: Literal["markdown_text"] = "markdown_text"
    content: str

class ValuationMetric(BaseModel):
    """
    Comprehensive Valuation Card 내부의 개별 지표
    """
    label: str  # e.g., "PER"
    value: str  # e.g., "34.1x"
    comparison: Optional[str] = None  # e.g., "vs 5yr Avg 25.5x"
    trend: Literal["up", "down", "flat"] = "flat"
    status: Literal["good", "bad", "neutral"] = "neutral"

class ComprehensiveValuationWidget(Widget):
    """
    통합된 Valuation Card 위젯
    """
    type: Literal["comprehensive_valuation"] = "comprehensive_valuation"
    ticker: str
    price: str
    change: str
    badges: List[str] = []
    score: int
    status: Literal["good", "neutral", "bad", "warning"]
    summary: str
    metrics: List[ValuationMetric]

# --- Response Schema ---

class AnalysisMeta(BaseModel):
    ticker: str
    period: str  # "annual" or "quarter"

class AnalysisHeader(BaseModel):
    status: Literal["good", "neutral", "bad", "warning"]
    score: int  # 0-100
    title: str  # 한줄 요약
    badges: List[str] = []  # ["저평가", "고수익", "성장주"]

class AnalysisResult(BaseModel):
    """
    Server-Driven UI 최종 응답 스키마
    """
    meta: AnalysisMeta
    header: AnalysisHeader
    widgets: List[Union[ComprehensiveValuationWidget, GaugeChart, SparklineCard, DonutChart, DataTable, MarkdownText]]
