## 서비스 리팩터링 요약

### 1. 공통 개편 방향
- `Collector` (기존 `fetch_*` 서비스) → `Analyzer` → `Presenter` 구조로 분리
- Analyzer: 비즈니스 로직·지표 계산 담당  
- Presenter: 사용자 요약/프롬프트용 텍스트 생성
- MCP는 Analyzer/Presetner가 만들어 준 `insights/summary`를 그대로 사용

### 2. 현금흐름 서비스 (`cash_flow_service.py`)
- Analyzer: `app/services/analyzers/cash_flow.py`
  - OCF/FCF 추세, 건강 점수, 현금 전환율, FCF 마진, SBC 조정 FCF 계산
  - 자본 배치(Buyback/Dividends)와 건강성 평가 로직 유지
- Presenter: `app/services/presenters/cash_flow.py`
  - 요약 섹션(현황/지표/현금 전환율/FCF 마진/주주 환원) 구조화
- Collector(`fetch_company_cash_flows`):
  - API→DB 업서트 후 Analyzer/Presenter 호출
  - 기존 `_build_cash_flow_insights`, `_summarize_cash_flow` 삭제

### 3. 밸류에이션 서비스 (`key_metrics_service.py`)
- Analyzer: `app/services/analyzers/valuation.py`
  - PER/평균/Forward, PEG, ROE/PBR/EV/EBITDA, Shareholder Yield 계산
  - Cash flow 컨텍스트(자사주 매입/배당)로 buyback yield 계산
- Presenter: `app/services/presenters/valuation.py`
  - PER/PEG 요약, 퀄리티 지표, 주주 환원 섹션 출력
- Collector(`fetch_company_key_metrics`):
  - Analyzer/Presenter 호출부만 남기고, 기존 `_build_pe_insights`/`_summarize_per` 제거
  - Cash flow 레코드에서 buyback/dividend 참고하도록 유지

### 4. MCP 시스템 프롬프트
- Valuation 섹션(###6) 업데이트: 새 인사이트 필드를 설명하고 응답 패턴 안내

### 5. 추가 메모
- Analyzer/Presenter 모듈은 모두 `app/services/analyzers/`, `app/services/presenters/` 디렉토리에 위치
- 향후 다른 도메인(성장성, 리스크 등)도 동일한 패턴으로 확장 가능

