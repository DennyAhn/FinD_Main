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
    # [FIX] Quarter는 더 많은 데이터 필요 (5년 × 4분기 = 20개)
    max_limit = 20 if normalized_period == "quarter" else 8
    limit = max(1, min(limit, max_limit))

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
                    # [중요] 현재 주가와 주식 수 먼저 가져오기 (계산에 필요)
                    current_price = _get_metric(quote_data.get("price"))
                    shares_outstanding = _get_metric(
                        quote_data.get("sharesOutstanding"),
                        payload.get("numberOfShares")
                    )
                    
                    # [FIX] PER - 직접 계산 우선 (FMP 값은 주가 타이밍 불일치 가능)
                    pe_ratio_fmp = _get_metric(
                        payload.get("peRatio"), 
                        payload.get("priceEarningsRatio")
                    )
                    
                    # TTM EPS (더 최신 데이터)
                    current_eps = _get_metric(
                        quote_data.get("eps"),  # TTM EPS (우선순위 높음)
                        payload.get("netIncomePerShare")
                    )
                    
                    pe_ratio = None
                    if current_price and current_eps and current_eps > 0:
                        # 직접 계산: PER = Price / EPS
                        pe_ratio = current_price / current_eps
                        
                        if pe_ratio_fmp:
                            diff_pct = abs((pe_ratio - pe_ratio_fmp) / pe_ratio_fmp * 100)
                            if diff_pct > 10:
                                print(f"[PER Warning] {ticker} {report_date}: Calculated {pe_ratio:.2f} vs FMP {pe_ratio_fmp:.2f} (Diff {diff_pct:.1f}%)")
                                print(f"  - Price: ${current_price:.2f}, EPS: ${current_eps:.2f}")
                        else:
                            print(f"[PER Calculated] {ticker} {report_date}: {pe_ratio:.2f} (Price ${current_price:.2f} / EPS ${current_eps:.2f})")
                    else:
                        # Fallback: FMP 값 사용
                        pe_ratio = pe_ratio_fmp
                        if pe_ratio:
                            print(f"[PER Fallback] {ticker} {report_date}: Using FMP {pe_ratio:.2f} (Missing Price or EPS)")
                    
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
                    
                    # [FIX] PBR - Balance Sheet에서 직접 계산 (FMP 값은 Equity 부정확)
                    # PBR = Price / Book Value Per Share
                    # Book Value Per Share = Total Equity / Shares Outstanding
                    price_to_book_ratio_fmp = _get_metric(
                        payload.get("priceToBookRatio"),
                        payload.get("priceBookValueRatio"),
                        payload.get("pbRatio"),
                    )
                    
                    price_to_book_ratio = None
                    # D/E Ratio 계산에서 이미 Balance Sheet를 가져왔으므로 재사용
                    try:
                        balance_sheet = db.query(models.CompanyBalanceSheet).filter_by(
                            ticker=ticker,
                            period=normalized_period,
                            report_date=report_date
                        ).first()
                        
                        if balance_sheet and balance_sheet.total_equity and shares_outstanding and current_price:
                            # Book Value Per Share 계산
                            book_value_per_share = balance_sheet.total_equity / shares_outstanding
                            
                            # PBR 계산
                            if book_value_per_share > 0:
                                price_to_book_ratio = current_price / book_value_per_share
                                
                                if price_to_book_ratio_fmp:
                                    diff_pct = abs((price_to_book_ratio - price_to_book_ratio_fmp) / price_to_book_ratio_fmp * 100)
                                    if diff_pct > 10:
                                        print(f"[PBR Warning] {ticker} {report_date}: Calculated {price_to_book_ratio:.2f} vs FMP {price_to_book_ratio_fmp:.2f} (Diff {diff_pct:.1f}%)")
                                        print(f"  - Price: ${current_price:.2f}, BPS: ${book_value_per_share:.2f} (Equity: ${balance_sheet.total_equity:.2f}B / Shares: {shares_outstanding:.2f}B)")
                                else:
                                    print(f"[PBR Calculated] {ticker} {report_date}: {price_to_book_ratio:.2f} (Price ${current_price:.2f} / BPS ${book_value_per_share:.2f})")
                        else:
                            # Fallback: FMP 값 사용
                            price_to_book_ratio = price_to_book_ratio_fmp
                            if price_to_book_ratio:
                                print(f"[PBR Fallback] {ticker} {report_date}: Using FMP {price_to_book_ratio:.2f} (Missing Balance Sheet or Shares)")
                    except Exception as e:
                        print(f"[PBR Error] {ticker} {report_date}: {e}")
                        price_to_book_ratio = price_to_book_ratio_fmp
                    
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
                    # [FIX] D/E Ratio - Balance Sheet에서 직접 계산 (FMP 값은 부정확)
                    # 
                    # [중요] 부채비율 계산 기준:
                    # - 총부채 기준 (Total Liabilities / Total Equity)
                    # - 유동부채 + 비유동부채 (매입채무, 차입금, 미지급금 등 모든 부채 포함)
                    # - 이자부담부채(차입금)만 계산하는 방식과는 다름
                    debt_to_equity = None
                    
                    # Balance Sheet에서 Total Liabilities / Total Equity 계산
                    try:
                        balance_sheet = db.query(models.CompanyBalanceSheet).filter_by(
                            ticker=ticker,
                            period=normalized_period,
                            report_date=report_date
                        ).first()
                        
                        # [FIX] Balance Sheet가 없거나 Equity 데이터가 없으면 자동으로 fetch
                        need_fetch = False
                        if not balance_sheet:
                            need_fetch = True
                            print(f"[D/E] Balance Sheet not found for {ticker} {report_date}, fetching from API...")
                        elif not balance_sheet.total_equity or balance_sheet.total_equity == 0:
                            need_fetch = True
                            print(f"[D/E] Balance Sheet exists but Equity is missing for {ticker} {report_date}, re-fetching...")
                        
                        if need_fetch:
                            from app.services.balance_sheet_service import fetch_company_balance_sheets
                            try:
                                # Balance Sheet 가져오기 (같은 period로)
                                # fetch_company_balance_sheets 내부에서 이미 commit하므로 여기서는 commit 불필요
                                await fetch_company_balance_sheets(ticker, db, client, normalized_period, limit=5)
                                
                                # 다시 조회
                                balance_sheet = db.query(models.CompanyBalanceSheet).filter_by(
                                    ticker=ticker,
                                    period=normalized_period,
                                    report_date=report_date
                                ).first()
                                
                                if balance_sheet and balance_sheet.total_equity:
                                    print(f"[D/E] Balance Sheet fetched successfully for {ticker} {report_date}")
                                else:
                                    print(f"[D/E] Balance Sheet still missing Equity after fetch for {ticker} {report_date}")
                            except Exception as fetch_error:
                                print(f"[D/E] Failed to fetch Balance Sheet: {fetch_error}")
                                # 에러 발생 시 세션 롤백하여 다음 처리 가능하도록
                                db.rollback()
                        
                        if balance_sheet:
                            total_liabilities = balance_sheet.total_liabilities
                            total_equity = balance_sheet.total_equity
                            
                            # D/E = Total Liabilities / Total Equity (총부채 기준)
                            # [금융 전문가 검증] 음의 자기자본 처리
                            if total_equity and total_liabilities is not None:
                                if total_equity > 0:
                                    debt_to_equity = total_liabilities / total_equity
                                elif total_equity < 0:
                                    # 음의 자기자본: 부채가 자산을 초과 (재무 위기 신호)
                                    debt_to_equity = None  # 의미 없는 값이므로 None 처리
                                    print(f"[D/E Warning] {ticker} {report_date}: Negative Equity ({total_equity}B) - 부채가 자산 초과!")
                                else:  # total_equity == 0
                                    debt_to_equity = None
                                    print(f"[D/E Warning] {ticker} {report_date}: Zero Equity - D/E 계산 불가")
                                
                                # [추가 정보] 차입금 기준 부채비율도 계산 (참고용)
                                long_term_debt = balance_sheet.long_term_debt or 0
                                short_term_debt = balance_sheet.short_term_debt or 0
                                total_debt = long_term_debt + short_term_debt
                                debt_only_ratio = total_debt / total_equity if total_debt > 0 else 0
                                
                                print(f"[D/E Calculated] {ticker} {report_date}:")
                                print(f"  - 총부채 기준: {total_liabilities:.2f}B / {total_equity:.2f}B = {debt_to_equity:.4f} (Total Liabilities)")
                                print(f"  - 차입금 기준: {total_debt:.2f}B / {total_equity:.2f}B = {debt_only_ratio:.4f} (Interest-Bearing Debt Only)")
                            else:
                                print(f"[D/E Warning] {ticker} {report_date}: Equity is zero or missing")
                        else:
                            # Fallback: FMP API 값 (신뢰도 낮음)
                            debt_to_equity = _get_metric(
                                payload.get("debtToEquity"),
                                payload.get("debtEquityRatio"),
                                payload.get("debtEquityTTM"),
                            )
                            if debt_to_equity:
                                print(f"[D/E Fallback] {ticker} {report_date}: Using FMP value {debt_to_equity:.4f} (BS not found)")
                    except Exception as e:
                        print(f"[D/E Error] {ticker} {report_date}: {e}")
                        # Final Fallback
                        debt_to_equity = _get_metric(
                            payload.get("debtToEquity"),
                            payload.get("debtEquityRatio"),
                            payload.get("debtEquityTTM"),
                        )
                    
                    # [FIX] Current Ratio - Balance Sheet에서 직접 계산
                    current_ratio = None
                    
                    try:
                        if balance_sheet:
                            current_assets = balance_sheet.total_current_assets
                            current_liabilities = balance_sheet.total_current_liabilities
                            
                            # Current Ratio = Current Assets / Current Liabilities
                            if current_liabilities and current_liabilities > 0 and current_assets is not None:
                                current_ratio = current_assets / current_liabilities
                                print(f"[CR Calculated] {ticker} {report_date}: {current_assets:.2f}B / {current_liabilities:.2f}B = {current_ratio:.4f}")
                            else:
                                # Fallback: FMP API 값
                                current_ratio = _get_metric(
                                    payload.get("currentRatio"), 
                                    payload.get("currentRatioTTM")
                                )
                        else:
                            # Fallback: FMP API 값
                            current_ratio = _get_metric(
                                payload.get("currentRatio"), 
                                payload.get("currentRatioTTM")
                            )
                    except Exception as e:
                        print(f"[CR Error] {ticker} {report_date}: {e}")
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
                        de_str = f"{debt_to_equity:.4f}" if debt_to_equity is not None else "None"
                        cr_str = f"{current_ratio:.4f}" if current_ratio is not None else "None"
                        print(f"[Key Metrics] Updated {ticker} {report_date}: D/E={de_str}, CR={cr_str}")
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
                        de_str = f"{debt_to_equity:.4f}" if debt_to_equity is not None else "None"
                        cr_str = f"{current_ratio:.4f}" if current_ratio is not None else "None"
                        print(f"[Key Metrics] Created {ticker} {report_date}: D/E={de_str}, CR={cr_str}")
                except Exception as e:
                    print(f"[Error] Failed to process key metrics record for {ticker} ({date_str}): {e}")
                    continue

            # 변경사항 커밋
            if cache_enabled:
                db.commit()  # key_metrics 데이터를 DB에 확정
                print(f"[Key Metrics] DB commit successful for {ticker} ({len(merged_data)} records)")
            else:
                print(f"[Key Metrics] Skipped DB save (cache_enabled=False) for {ticker}")
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

    # --- 5. [NEW] Calculate 5-Year Averages (For Valuation Context) ---
    # 전체 데이터로 평균 계산 (5개 사용)
    avg_metrics = {}
    if len(payload) >= 3: # 최소 3년치 데이터는 있어야 평균 의미 있음
        # 평균을 구할 지표들 (음수 제외, 0보다 큰 값만)
        keys_to_avg = ["pe_ratio", "price_to_book_ratio", "peg_ratio", "price_to_sales_ratio", "debt_to_equity"]
        
        for key in keys_to_avg:
            # 이상치(Outlier) 제거: PER > 500 등은 제외할 수도 있으나 일단 단순 평균
            values = [p[key] for p in payload if p.get(key) is not None and p[key] > 0]
            if values:
                avg_key = key.replace("_ratio", "").replace("_", "") # debt_to_equity -> avg_de
                if key == "pe_ratio": avg_key = "avg_pe"
                elif key == "peg_ratio": avg_key = "avg_peg"
                elif key == "price_to_book_ratio": avg_key = "avg_pbr"
                elif key == "debt_to_equity": avg_key = "avg_de"
                
                avg_metrics[avg_key] = sum(values) / len(values)
    
    # [전문가 최적화] AI에게는 최신 2개 + 평균값만 전달 (Token 절약 & 명확성)
    # payload_full: 전체 데이터 (5개) - 백엔드 내부 사용 및 위젯용
    # payload_for_ai: AI 응답용 (최신 2개만)
    payload_full = payload.copy()
    payload_for_ai = payload[:2] if len(payload) >= 2 else payload
    
    # 최신 데이터에 평균값 주입 (AI가 비교 분석 가능하도록)
    if payload_for_ai:
        payload_for_ai[0].update(avg_metrics)
        
        # [Wall Street Standard] YoY 변화율 계산 (백엔드에서)
        if len(payload_for_ai) >= 2:
            current = payload_for_ai[0]
            previous = payload_for_ai[1]
            yoy_changes = {}
            
            # 주요 지표의 YoY 변화율 계산
            metrics_to_compare = [
                "debt_to_equity",
                "current_ratio", 
                "pe_ratio",
                "price_to_book_ratio",
                "return_on_equity",
                "return_on_assets",
                "peg_ratio"
            ]
            
            for metric in metrics_to_compare:
                curr_val = current.get(metric)
                prev_val = previous.get(metric)
                
                if curr_val is not None and prev_val is not None and prev_val != 0:
                    # 변화율 계산: (Current - Previous) / Previous * 100
                    change_pct = ((curr_val - prev_val) / abs(prev_val)) * 100
                    yoy_changes[f"{metric}_yoy_change_pct"] = round(change_pct, 2)
                    yoy_changes[f"{metric}_previous"] = prev_val
            
            # 최신 데이터에 변화율 주입
            payload_for_ai[0].update(yoy_changes)
            print(f"[Key Metrics] AI에게 전달: {len(payload_for_ai)}개 데이터 (최신 + 전년), 평균값 + YoY 변화율 포함")
            print(f"[YoY Changes] D/E: {yoy_changes.get('debt_to_equity_yoy_change_pct', 'N/A')}%, PE: {yoy_changes.get('pe_ratio_yoy_change_pct', 'N/A')}%")
        else:
            print(f"[Key Metrics] AI에게 전달: {len(payload_for_ai)}개 데이터 (최신만), 평균값 포함")

    # --- 6. Server-Driven UI Framework Integration ---
    from app.services.analyzers.valuation_analyzer import analyze_valuation
    from app.services.presenters.valuation_presenter import present_valuation

    # 1) Analyze (전체 데이터 사용 - 평균 계산 등에 필요)
    analysis = analyze_valuation({"metrics": payload_full})
    
    # 2) Present (Generate Widgets)
    # AnalysisResult 객체 생성
    result_obj = present_valuation(ticker, normalized_period, analysis)
    
    # 3) Convert to Dict (for MCP Service)
    # Pydantic 모델을 dict로 변환하여 반환
    final_result = result_obj.model_dump()
    
    # [전문가 최적화] AI에게는 최신 2개만 전달 (비교 분석용)
    final_result["records"] = payload_for_ai
    final_result["history"] = payload_full  # 위젯/차트용으로 전체 데이터 포함
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
