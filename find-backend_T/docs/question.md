## MCP 질문 가이드

### 1. 질문 가능 범위 (백엔드 서비스 기준)
- **현금흐름**: `fetch_company_cash_flows`  
  - 최신 OCF/FCF 추이, Cash Conversion Ratio, FCF 마진, SBC 조정 FCF, 자본 배치
- **밸류에이션(주요 재무 비율)**: `fetch_company_key_metrics`  
  - PER/Forward PER, PEG, ROE/ROA, PBR, EV/EBITDA, Shareholder Yield
- **기타**: 이미 구축된 Collector/Analyzer/Presenter 패턴을 따르는 서비스들

### 2. 질문 예시 & 기대 답변
| 질문 | 호출 서비스 | 예상 핵심 답변 |
| --- | --- | --- |
| “애플 최근 현금흐름 어때?” | `fetch_company_cash_flows` | 📊 요약(기준일, 건강등급) + 💰 OCF/FCF 추이 + 📌 Cash Conversion & FCF 마진 + 🏦 자본 배치 (SBC, Buyback, 배당) |
| “NVDA PER 정리해줘” | `fetch_company_key_metrics` | 📊 PER/Forward PER vs 평균 + PEG 해석 + ⚙️ ROE/PBR/EV/EBITDA + 💸 Shareholder Yield |
| “테슬라 분기별 PER?” | `fetch_company_key_metrics(period="quarter")` | 분기별 PER 테이블 + 요약 (전/평균 대비 변화, PEG) |
| “배당+자사주 매입 많이 하는 기업?” | `fetch_company_cash_flows` 또는 `fetch_company_key_metrics` | 자본 배치/Shareholder Yield 수치와 인사이트 안내 |
| “최근 주가 하락 이유는?” | 복합 (`search_summarized_news`, `fetch_company_key_metrics`, `fetch_company_cash_flows`, `fetch_earnings_calendar`, `fetch_analyst_ratings` 등) | 뉴스+실적+현금흐름+애널리스트 평가를 종합한 스토리 (MCP 프롬프트의 “Complex Inference” 규칙) |
| “어떤 이벤트가 앞두고 있어?” | `fetch_earnings_calendar`, `fetch_news` 등 | 예정된 실적 발표, 주요 뉴스, 애널리스트 코멘트 |
| “이 회사 실적 추이는?” | `fetch_company_income_statements`, `fetch_company_balance_sheets`, `fetch_company_cash_flows` | 손익/대차/현금흐름 USP 정리 (Collector+Analyzer) |

### 3. 효과
- **일관된 구조**: Collector → Analyzer → Presenter로 데이터 흐름이 명확
- **응답 품질**: 분석(숫자) + 서술(프리젠테이션)이 표준화되어 질문마다 기대 가능한 답변 형태가 고정
- **확장 용이**: 새로운 지표나 도메인도 Analyzer/Presenter 추가만으로 동일 UX 제공 가능

