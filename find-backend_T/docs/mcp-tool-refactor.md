# MCP 도구 자동화 리팩터링 회고

## 배경과 문제 인식
- 기존 `app/mcp/registry.py`는 OpenAI ToolCall 스펙을 수동으로 JSON으로 작성.
- 도구 추가/변경 시 JSON·함수 매핑을 동시에 손봐야 해서 실수 가능성과 유지보수 비용 상승.
- LangChain의 `@tool`처럼 자동으로 스키마를 만들고 싶지만, 전체 프레임워크를 도입하면 의존성과 구조가 복잡해짐.

## 목표
1. OpenAI ToolCall 방식은 유지.
2. 서비스 함수 정의만으로 도구 스키마와 실행 매핑이 자동 생성.
3. FastAPI/DB 의존성 주입 구조와 충돌하지 않는 경량 솔루션.

## 해결 전략
### 1. 데코레이터 기반 등록소 구축
- `app/mcp/decorators.py`에 `@register_tool`을 정의하여 도구 함수가 임포트 순간 자동 등록되도록 설계.
- 중복 등록 방지, 타입 힌트 → JSON 스키마 변환(`type_to_json_schema`) 헬퍼 추가.

### 2. 서비스 레이어 표준화
- `app/services` 하위의 도구 함수들에 `@register_tool` 적용.
- 함수를 설명하는 독스트링과 타입 힌트를 정돈해 스키마 품질 보장.
- (예: `fetch_stock_quote`, `fetch_financial_statement`, `search_company_by_name` 등)

### 3. 레지스트리 자동 생성
- `app/mcp/registry.py`에서 서비스 모듈을 임포트 → 등록된 함수 목록 확보.
- `build_tool_schema()`로 함수별 OpenAI Tool JSON 생성.
- `tools_schema`, `available_tools`를 자동화하여 MCP 서비스가 그대로 사용.

### 4. MCP 서비스 호환성 유지
- `app/mcp/service.py`는 기존 의존성 주입 로직(`inspect.signature` 활용)을 유지.
- OpenAI 호출 시 `tools_schema` 사용, 실제 실행은 `available_tools` 사전을 통해 매핑.

## 구조적 장점
- 도구 정의가 “함수 한 곳”에만 존재 → JSON/매핑 중복 제거.
- 타입 힌트와 독스트링이 자동 반영되어 문서화 품질 확보.
- 외부 의존성 증가 없이 기존 MCP(OpenAI ToolCall) 흐름 유지.
- 신규 도구 추가 시 데코레이터만 붙이면 되므로 개발 생산성 향상.

## 한계와 향후 과제
- `_type_to_json_schema`는 단순 타입만 지원 → 복합 타입(예: Enum, nested object)은 수동 확장 필요.
- 서비스 함수에 타입 힌트/독스트링이 누락되면 스키마 품질 저하.
- 도구 임포트 순환 의존성에 주의 (현재 구조에서는 문제 없음).

## 성과
- `app/mcp/registry.py` 166라인 → 30여 라인으로 축소, 레지스트리 관리 간소화.
- 도구 추가/수정 시 발생하던 인적 오류(파라미터 누락, JSON 불일치 등) 예방.
- “LangChain의 장점만 가져온” 자체 경량 솔루션으로 아키텍처 제어권 유지.

## 느낀 점
- 프레임워크 도입보다 팀의 요구에 딱 맞는 경량 도구를 만드는 편이 더 실용적일 때가 있다.
- 타입 힌트와 독스트링을 꾸준히 관리해야 자동화 파이프라인이 건강하게 돌아간다는 점을 체감했다.
- 작은 유틸 하나가 프로젝트 전반의 생산성과 안정성을 크게 끌어올릴 수 있었다.

