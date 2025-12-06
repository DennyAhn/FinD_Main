"""주요 재무 지표 조회 서비스."""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

import httpx
from sqlalchemy.orm import Session

from app import models
from app.config import FMP_API_KEY, FMP_BASE_URL
from app.mcp.decorators import register_tool
from app.services.profile_service import fetch_company_profile

# FMP v3 API (프리미엄)
KEY_METRICS_URL = f"{FMP_BASE_URL}/key-metrics"
FINANCIAL_RATIOS_URL = f"{FMP_BASE_URL}/financial-ratios"
QUOTE_URL = f"{FMP_BASE_URL}/quote"
ESTIMATES_URL = f"{FMP_BASE_URL}/analyst-estimates"
CACHE_TTL = timedelta(hours=24)


def _get_metric(*values: Any) -> Optional[float]:
    """여러 값 중 첫 번째로 'None'이 아닌 유효한 float 값을 반환합니다."""
    for value in values:
        if value is None:
            continue
        if isinstance(value, (int, float)):
            return float(value)
        if isinstance(value, str):
            try:
                return float(value)
            except (TypeError, ValueError):
                continue
    return None


def _get_int_metric(*values: Any) -> Optional[int]:
    """여러 값 중 첫 번째로 유효한 값을 찾아 int로 변환하여 반환합니다."""
    val = _get_metric(*values)
    if val is not None:
        return int(val)
    return None


@register_tool
async def fetch_company_key_metrics(
    ticker: str,
    db: Session,
    client: httpx.AsyncClient,
    period: str = "annual",
    limit: int = 5,
) -> Dict[str, Any]:
    """
    [AI용 설명] 특정 티커(ticker)의 '주요 재무 비율'(PER, PBR, ROE, ROA 등)을
    DB에서 조회하거나 API로 가져옵니다.
    
    period 파라미터:
    - "annual": 연간 데이터 (기본값, 최근 5개 연도)
    - "quarter": 분기별 데이터 (최근 8개 분기, 올해 분기 포함)
    
    사용자가 "올해 분기별 PER" 또는 "분기별 PER"을 요청하면 period="quarter"로 호출하세요.
    """

    normalized_period = (period or "annual").lower()
    if normalized_period == "quarterly":
        normalized_period = "quarter"
    if normalized_period not in {"annual", "quarter"}:
        raise ValueError("period 값은 'annual' 또는 'quarter'만 지원합니다.")

    if limit:
        limit = int(limit)
    limit = max(1, min(limit, 8))

    # --- 0. 프로필 보강 [수정됨] ---
    # profile_service가 commit을 하므로, 우리는 DB에서 조회만 합니다.
    db_profile = db.query(models.CompanyProfile).filter_by(ticker=ticker).first()

    if not db_profile:
        # DB에 없으면, profile_service를 '선행 호출'하여 DB에 생성시킴
        profile_result = await fetch_company_profile(ticker=ticker, db=db, client=client)

        if not profile_result:
            # 선행 호출(API)까지 실패하면, key_metrics 저장이 불가능하므로 포기
            print(f"[Error] company_profile missing for {ticker}; aborting key_metrics.")
            return {
                "records": [],
                "insights": None,
                "summary": "회사 프로필 정보를 확보하지 못해 PER 데이터를 저장/조회할 수 없습니다.",
            }

        # 선행 호출이 성공했으므로, db_profile을 다시 조회 (필수는 아니지만 안전함)
        db_profile = db.query(models.CompanyProfile).filter_by(ticker=ticker).first()

    # [수정] cache_enabled는 Foreign Key와 관계 없음
    cache_enabled = True

    # --- 2. [핵심] 캐시 전략 (24시간 TTL) ---
    latest_in_db = (
        db.query(models.CompanyKeyMetrics)
        .filter_by(ticker=ticker, period=normalized_period)
        .order_by(models.CompanyKeyMetrics.report_date.desc())
        .first()
    )

    needs_update = True
    merged_data: Dict[str, Dict[str, Any]] = {}
    
    if latest_in_db and latest_in_db.created_at:
        if latest_in_db.created_at > datetime.utcnow() - CACHE_TTL:
            needs_update = False
            print(f"[Cache HIT] DB에서 Key Metrics ({ticker}) 조회")

    if needs_update:
        print(f"[Cache MISS] FMP API 4개 동시 호출: key-metrics, ratios, quote, estimates ({ticker})")

        # --- 3. [핵심] 4개의 API를 병렬 호출 ---
        try:
            # 1) /key-metrics 호출
            url_metrics = (
                f"{KEY_METRICS_URL}/{ticker}"
                f"?period={normalized_period}&limit={limit}&apikey={FMP_API_KEY}"
            )
            # 2) /financial-ratios 호출
            url_ratios = (
                f"{FINANCIAL_RATIOS_URL}/{ticker}"
                f"?period={normalized_period}&limit={limit}&apikey={FMP_API_KEY}"
            )
            # 3) /quote 호출 (현재 주가, 주식 수)
            url_quote = f"{QUOTE_URL}/{ticker}?apikey={FMP_API_KEY}"
            
            # 4) /analyst-estimates 호출 (미래 EPS -> Forward PE, PEG 계산용)
            # [수정] limit=30으로 늘려서 전체 연도 데이터를 가져옴 (정확한 매칭 위해)
            url_estimates = f"{ESTIMATES_URL}/{ticker}?period=annual&limit=30&apikey={FMP_API_KEY}"

            # asyncio.gather로 병렬 실행
            responses = await asyncio.gather(
                client.get(url_metrics),
                client.get(url_ratios),
                client.get(url_quote),
                client.get(url_estimates),
                return_exceptions=True
            )

            # 응답 처리
            resp_metrics, resp_ratios, resp_quote, resp_estimates = responses

            metrics_data = []
            if isinstance(resp_metrics, httpx.Response) and resp_metrics.status_code == 200:
                metrics_data = resp_metrics.json() or []
            
            ratios_data = []
            if isinstance(resp_ratios, httpx.Response) and resp_ratios.status_code == 200:
                ratios_data = resp_ratios.json() or []
                
            quote_data = {}
            if isinstance(resp_quote, httpx.Response) and resp_quote.status_code == 200:
                q_list = resp_quote.json()
                if q_list and isinstance(q_list, list):
                    quote_data = q_list[0]
            
            estimates_map = {}
            if isinstance(resp_estimates, httpx.Response) and resp_estimates.status_code == 200:
                e_list = resp_estimates.json()
                if e_list and isinstance(e_list, list):
                    for est in e_list:
                        # date: "2025-09-27" -> year: 2025
                        est_date = est.get("date")
                        if est_date:
                            try:
                                y = int(est_date.split("-")[0])
                                estimates_map[y] = est
                            except (ValueError, IndexError):
                                pass

            # 3) 'date'를 기준으로 두 API 응답을 딕셔너리로 병합 (Safe Merge)
            # metrics_data를 기본으로 설정
            for item in metrics_data:
                date = item.get("date")
                if date:
                    merged_data[date] = item.copy()

            # ratios_data를 병합
            for item in ratios_data:
                date = item.get("date")
                if not date:
                    continue

                if date not in merged_data:
                    merged_data[date] = item.copy()
                else:
                    # Safe Merge
                    for key, value in item.items():
                        if value is not None:
                            merged_data[date][key] = value

            # 4) DB에 UPSERT
            for date_str, payload in merged_data.items():
                try:
                    try:
                        report_date = datetime.fromisoformat(date_str).date()
                    except ValueError:
                        print(f"[Warning] Invalid date format for {ticker}: {date_str}")
                        continue

                    # report_year 안전하게 파싱
                    raw_year = payload.get("calendarYear") or date_str[:4]
                    try:
                        report_year_val = int(raw_year)
                    except (ValueError, TypeError):
                        print(f"[Warning] Invalid report_year for {ticker} ({date_str}): {raw_year}")
                        continue

                    # 기존 레코드 조회
                    existing_record = db.query(models.CompanyKeyMetrics).filter_by(
                        ticker=ticker,
                        period=normalized_period,
                        report_date=report_date
                    ).first()

                    # --- 필드 매핑 및 데이터 정제 ---
                    
                    # 1. Valuation Ratios
                    pe_ratio = _get_metric(
                        payload.get("peRatio"), 
                        payload.get("priceEarningsRatio")
                    )
                    
                    # [NEW] Forward PE & PEG 계산
                    forward_pe = _get_metric(
                        payload.get("forwardPE"),
                        payload.get("peRatioForward"),
                        payload.get("priceEarningsRatio"),
                    )
                    peg_ratio = _get_metric(
                        payload.get("priceEarningsToGrowthRatio"),
                        payload.get("pegRatio"),
                        payload.get("pegRatioTTM"),
                    )

                    # 계산 로직: 데이터가 없고 최신 연도인 경우
                    
                    # 현재 주가
                    current_price = _get_metric(quote_data.get("price"))
                    
                    # [수정] 정확한 연도 매칭을 통한 예상 EPS 조회
                    # Forward PE는 통상 '다음 회계연도' 기준
                    target_year = report_year_val + 1
                    next_year_est = estimates_map.get(target_year)
                    
                    estimated_eps_next = None
                    if next_year_est:
                        estimated_eps_next = _get_metric(
                            next_year_est.get("estimatedEpsAvg"),
                            next_year_est.get("estimatedEps")
                        )

                    # Forward PE 계산 (데이터가 없을 때만)
                    if forward_pe is None and current_price and estimated_eps_next and estimated_eps_next > 0:
                        # Forward PE = Price / Estimated EPS (Next Year)
                        forward_pe = current_price / estimated_eps_next
                    
                    # PEG Ratio 계산 (데이터가 없을 때만)
                    # PEG = PE / Growth Rate
                    # Growth Rate = ((Estimated EPS(Next) - Current EPS) / Current EPS) * 100
                    current_eps = _get_metric(payload.get("netIncomePerShare"), quote_data.get("eps"))
                    
                    if peg_ratio is None and pe_ratio and current_eps and estimated_eps_next:
                        try:
                            if abs(current_eps) > 0.01: # 0으로 나누기 방지
                                growth_rate = ((estimated_eps_next - current_eps) / abs(current_eps)) * 100
                                # [Wall Street Standard] PEG = Forward PE / Growth Rate
                                metric_pe = forward_pe if forward_pe and forward_pe > 0 else pe_ratio
                                if growth_rate > 0 and metric_pe:
                                    calc_peg = metric_pe / growth_rate
                                    # [Safety Check] PEG < 0.1 is usually a data error (implies >400% growth for PE 40)
                                    if calc_peg > 0.1:
                                        peg_ratio = calc_peg
                                    else:
                                        print(f"[Warning] PEG {calc_peg} too low, discarding.")
                        except Exception:
                            pass

                    price_to_sales_ratio = _get_metric(
                        payload.get("priceToSalesRatio"),
                        payload.get("priceToSalesRatioTTM"),
                    )
                    price_to_book_ratio = _get_metric(
                        payload.get("priceToBookRatio"),
                        payload.get("priceBookValueRatio"),
                        payload.get("pbRatio"),
                    )
                    enterprise_value_to_ebitda = _get_metric(
                        payload.get("enterpriseValueOverEBITDA"),
                        payload.get("enterpriseValueEbitdaRatio"),
                    )

                    # 2. Profitability & Returns
                    return_on_equity = _get_metric(
                        payload.get("returnOnEquity"),
                        payload.get("returnOnEquityTTM"),
                        payload.get("roe"),
                    )
                    return_on_assets = _get_metric(
                        payload.get("returnOnAssets"), 
                        payload.get("returnOnAssetsTTM")
                    )
                    
                    # 3. Liquidity & Health
                    debt_to_equity = _get_metric(
                        payload.get("debtToEquity"),
                        payload.get("debtEquityRatio"),
                        payload.get("debtEquityTTM"),
                    )
                    current_ratio = _get_metric(
                        payload.get("currentRatio"), 
                        payload.get("currentRatioTTM")
                    )
                    
                    # 4. Per Share Metrics
                    revenue_per_share = _get_metric(payload.get("revenuePerShare"))
                    net_income_per_share = _get_metric(payload.get("netIncomePerShare"))
                    book_value_per_share = _get_metric(payload.get("bookValuePerShare"))
                    free_cash_flow_per_share = _get_metric(
                        payload.get("freeCashFlowPerShare")
                    )
                    dividend_yield = _get_metric(payload.get("dividendYield"))

                    # 5. Market Data (Integer conversion)
                    # [NEW] Quote 데이터 fallback 추가
                    shares_outstanding = _get_int_metric(
                        payload.get("weightedAverageSharesOutstanding"),
                        payload.get("sharesOutstanding"),
                        payload.get("commonStockSharesOutstanding"),
                        payload.get("weightedAverageShsOut"),
                        quote_data.get("sharesOutstanding") # Fallback
                    )
                    market_cap = _get_int_metric(
                        payload.get("marketCap"),
                        quote_data.get("marketCap") # Fallback
                    )

                    if existing_record:
                        # 기존 레코드 업데이트
                        existing_record.report_year = report_year_val
                        existing_record.pe_ratio = pe_ratio
                        existing_record.forward_pe = forward_pe
                        existing_record.peg_ratio = peg_ratio
                        existing_record.enterprise_value_to_ebitda = enterprise_value_to_ebitda
                        existing_record.price_to_book_ratio = price_to_book_ratio
                        existing_record.return_on_equity = return_on_equity
                        existing_record.return_on_assets = return_on_assets
                        existing_record.debt_to_equity = debt_to_equity
                        existing_record.current_ratio = current_ratio
                        existing_record.dividend_yield = dividend_yield
                        existing_record.book_value_per_share = book_value_per_share
                        existing_record.free_cash_flow_per_share = free_cash_flow_per_share
                        existing_record.shares_outstanding = shares_outstanding
                        existing_record.market_cap = market_cap
                        existing_record.revenue_per_share = revenue_per_share
                        existing_record.net_income_per_share = net_income_per_share
                        existing_record.price_to_sales_ratio = price_to_sales_ratio
                    else:
                        # 새 레코드 추가
                        new_record = models.CompanyKeyMetrics(
                            ticker=ticker,
                            period=normalized_period,
                            report_date=report_date,
                            report_year=report_year_val,
                            pe_ratio=pe_ratio,
                            forward_pe=forward_pe,
                            peg_ratio=peg_ratio,
                            enterprise_value_to_ebitda=enterprise_value_to_ebitda,
                            price_to_book_ratio=price_to_book_ratio,
                            return_on_equity=return_on_equity,
                            return_on_assets=return_on_assets,
                            debt_to_equity=debt_to_equity,
                            current_ratio=current_ratio,
                            dividend_yield=dividend_yield,
                            book_value_per_share=book_value_per_share,
                            free_cash_flow_per_share=free_cash_flow_per_share,
                            shares_outstanding=shares_outstanding,
                            market_cap=market_cap,
                            revenue_per_share=revenue_per_share,
                            net_income_per_share=net_income_per_share,
                            price_to_sales_ratio=price_to_sales_ratio,
                        )
                        db.add(new_record)
                except Exception as e:
                    print(f"[Error] Failed to process key metrics record for {ticker} ({date_str}): {e}")
                    continue

            # 변경사항 커밋
            if cache_enabled:
                db.commit()  # key_metrics 데이터를 DB에 확정
        except Exception as e:
            db.rollback()
            print(f"fetch_company_key_metrics API/DB 에러: {e}")
            # API 호출이 실패해도, DB에 있는 기존 데이터라도 반환

    # --- 4. [핵심] "순수 데이터"만 반환 ---
    # (AI가 분석/요약할 수 있도록 '가공되지 않은' DB 데이터를 반환)
    final_records = (
        db.query(models.CompanyKeyMetrics)
        .filter_by(ticker=ticker, period=normalized_period)
        .order_by(models.CompanyKeyMetrics.report_date.desc())
        .limit(limit)
        .all()
    )

    # ... (records = db.query(...) 로직은 동일) ...
    payload = [
        {
            "report_date": r.report_date.isoformat(),
            "report_year": r.report_year,
            "pe_ratio": float(r.pe_ratio) if r.pe_ratio is not None else None,
            "price_to_book_ratio": (
                float(r.price_to_book_ratio) if r.price_to_book_ratio is not None else None
            ),
            "forward_pe": float(r.forward_pe) if r.forward_pe is not None else None,
            "peg_ratio": float(r.peg_ratio) if r.peg_ratio is not None else None,
            "enterprise_value_to_ebitda": (
                float(r.enterprise_value_to_ebitda)
                if r.enterprise_value_to_ebitda is not None
                else None
            ),
            "return_on_equity": (
                float(r.return_on_equity) if r.return_on_equity is not None else None
            ),
            "return_on_assets": (
                float(r.return_on_assets) if r.return_on_assets is not None else None
            ),
            "debt_to_equity": (
                float(r.debt_to_equity) if r.debt_to_equity is not None else None
            ),
            "dividend_yield": (
                float(r.dividend_yield) if r.dividend_yield is not None else None
            ),
            "current_ratio": (
                float(r.current_ratio) if r.current_ratio is not None else None
            ),
            "revenue_per_share": (
                float(r.revenue_per_share) if r.revenue_per_share is not None else None
            ),
            "net_income_per_share": (
                float(r.net_income_per_share)
                if r.net_income_per_share is not None
                else None
            ),
            "free_cash_flow_per_share": (
                float(r.free_cash_flow_per_share)
                if r.free_cash_flow_per_share is not None
                else None
            ),
            "shares_outstanding": (
                float(r.shares_outstanding)
                if r.shares_outstanding is not None
                else None
            ),
            "market_cap": float(r.market_cap) if r.market_cap is not None else None,
            "book_value_per_share": (
                float(r.book_value_per_share)
                if r.book_value_per_share is not None
                else None
            ),
            "price_to_sales_ratio": (
                float(r.price_to_sales_ratio)
                if r.price_to_sales_ratio is not None
                else None
            ),
        }
        for r in final_records
    ]

    latest_cash_flow = (
        db.query(models.CompanyCashFlow)
        .filter_by(ticker=ticker, period=normalized_period)
        .order_by(models.CompanyCashFlow.report_date.desc())
        .first()
    )
    cash_flow_context = None
    if latest_cash_flow:
        cash_flow_context = {
            "report_date": latest_cash_flow.report_date.isoformat(),
            "common_stock_repurchased": latest_cash_flow.common_stock_repurchased,
            "dividends_paid": latest_cash_flow.dividends_paid,
        }

    # --- 5. [NEW] Server-Driven UI Framework Integration ---
    from app.services.analyzers.valuation_analyzer import analyze_valuation
    from app.services.presenters.valuation_presenter import present_valuation

    # 1) Analyze
    analysis = analyze_valuation({"metrics": payload})
    
    # 2) Present (Generate Widgets)
    # AnalysisResult 객체 생성
    result_obj = present_valuation(ticker, normalized_period, analysis)
    
    # 3) Convert to Dict (for MCP Service)
    # Pydantic 모델을 dict로 변환하여 반환
    final_result = result_obj.model_dump()
    final_result["records"] = payload
    return final_result





    final_result["records"] = payload
    return final_result


def _describe_market_cap(value: float) -> str:
    tiers = [
        (200_000_000_000, "Mega Cap (>$200B)"),
        (100_000_000_000, "Large Cap (>$100B)"),
        (10_000_000_000, "Mid Cap (>$10B)"),
        (2_000_000_000, "Small Cap (>$2B)"),
    ]
    for threshold, label in tiers:
        if value >= threshold:
            return label
    return "Micro Cap (<$2B)"


def _describe_pe(pe: float) -> Tuple[str, str]:
    if pe >= 30:
        return "고평가 구간", "warning"
    if pe >= 15:
        return "적정 밸류", "neutral"
    if pe > 0:
        return "저평가 구간", "good"
    return "적자 상태", "bad"


def _describe_roe(roe_percent: float) -> Tuple[str, str]:
    if roe_percent >= 20:
        return "매우 높은 수익성", "good"
    if roe_percent >= 10:
        return "양호한 수익성", "neutral"
    if roe_percent > 0:
        return "낮은 수익성", "warning"
    return "적자 구간", "bad"


def _describe_dividend(dividend_percent: float) -> Tuple[str, str]:
    if dividend_percent >= 4:
        return "고배당 수준", "good"
    if dividend_percent >= 2:
        return "보통 배당", "neutral"
    if dividend_percent > 0:
        return "저배당", "warning"
    return "배당 없음", "neutral"


def _format_market_cap_usd(value: float) -> str:
    if value >= 1e12:
        return f"${value / 1e12:.2f}T"
    if value >= 1e9:
        return f"${value / 1e9:.2f}B"
    if value >= 1e6:
        return f"${value / 1e6:.2f}M"
    return f"${value:,.0f}"


@register_tool
async def fetch_metrics_grid_widget(
    ticker: str,
    db: Session,
    client: httpx.AsyncClient
) -> dict:
    """
    [Dashboard] 핵심 지표 그리드 위젯용 데이터를 생성합니다.
    """
    data = await fetch_company_key_metrics(ticker, db, client, limit=2)
    records = data.get("records", [])
    
    if not records:
        return None
        
    latest = records[0]
    prev = records[1] if len(records) > 1 else None
    
    items = []
    
    market_cap = latest.get("market_cap")
    if market_cap:
        val_krw = (market_cap * 1460) / 1e12
        formatted = _format_market_cap_usd(market_cap)
        descriptor = _describe_market_cap(market_cap)
        items.append({
            "label": "시가총액",
            "value": market_cap,
            "formatted": formatted,
            "sub_text": f"≈{val_krw:.1f}조원 · {descriptor}",
            "status": "neutral",
            "trend": "down" if prev and market_cap < prev.get("market_cap", market_cap) else "up"
        })
        
    pe = latest.get("pe_ratio")
    if pe is not None:
        sub_text, status = _describe_pe(pe)
        items.append({
            "label": "PER",
            "value": pe,
            "formatted": f"{pe:.2f}",
            "sub_text": sub_text,
            "status": status,
            "trend": "down" if prev and pe < prev.get("pe_ratio", pe) else "up"
        })
        
    roe = latest.get("return_on_equity")
    if roe is not None:
        roe_val = roe * 100
        sub_text, status = _describe_roe(roe_val)
        items.append({
            "label": "ROE",
            "value": roe_val,
            "formatted": f"{roe_val:.2f}%",
            "sub_text": sub_text,
            "status": status,
            "trend": "up" if prev and roe_val >= (prev.get("return_on_equity") or 0) * 100 else "flat"
        })
        
    div = latest.get("dividend_yield")
    if div is not None:
        div_val = div * 100
        sub_text, status = _describe_dividend(div_val)
        items.append({
            "label": "배당수익률",
            "value": div_val,
            "formatted": f"{div_val:.2f}%",
            "sub_text": sub_text,
            "status": status,
            "trend": "flat"
        })
        
    return {
        "type": "metrics_grid",
        "items": items
    }
