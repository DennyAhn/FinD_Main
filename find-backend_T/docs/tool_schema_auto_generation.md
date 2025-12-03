# MCP 도구 스키마 자동 생성 구조

## 1. 개요
- `app/services/` 하위의 MCP 도구 함수는 `@register_tool` 데코레이터로 등록됩니다.
- 등록된 함수들을 기반으로 `app/mcp/decorators.py`의 `build_tool_schema`가 OpenAI가 요구하는 JSON 스키마를 자동으로 만듭니다.
- `app/mcp/registry.py`는 모든 서비스 모듈을 import하여 등록 과정을 트리거하고, 생성된 스키마(`tools_schema`)와 함수 매핑(`available_tools`)을 노출합니다.
- `app/mcp/service.py`는 위에서 생성한 스키마를 OpenAI API 호출에 전달하고, 실제 함수 실행을 관리합니다.

## 2. 핵심 구성 요소
### 2.1 `@register_tool` (app/mcp/decorators.py)
- 도구 함수를 글로벌 레지스트리에 저장합니다.
- 동일한 함수가 중복 등록되지 않도록 제어합니다.

### 2.2 `build_tool_schema`
- 함수 시그니처와 docstring을 검사해 JSON 스키마를 생성합니다.
- `db`, `client`, `httpx_client`, `current_user` 등 내부 의존성 파라미터는 자동으로 제외합니다.
- `type_to_json_schema`를 이용해 Python 타입 힌트를 OpenAI용 JSON 타입으로 변환합니다.

### 2.3 `generate_tool_config` (app/mcp/registry.py)
- `get_registered_tools()`로 수집된 함수 목록을 순회합니다.
- 각 함수에 대해 `build_tool_schema`를 호출하여 `tools_schema` 리스트를 채웁니다.
- 동시에 `{함수명: 함수 객체}` 형태의 `available_tools` 딕셔너리를 생성합니다.

### 2.4 MCP 서비스 루프 (app/mcp/service.py)
- 대화 히스토리를 구성하고 `tools_schema`를 포함해 OpenAI에 1차 메시지를 보냅니다.
- 모델이 선택한 도구 호출 정보를 확인하고, 필요한 의존성을 자동 주입한 뒤 실제 함수를 실행합니다.
- 도구 실행 결과를 메시지에 추가한 뒤 2차 호출로 최종 답변을 생성합니다.

## 3. 스키마 자동 갱신 흐름
1. 서비스 함수 정의(시그니처, docstring)를 수정합니다.
2. `register_tool`가 자동으로 해당 함수를 레지스트리에 반영합니다.
3. `generate_tool_config()`가 호출되면 `build_tool_schema`가 새로운 시그니처를 읽어 최신 스키마를 생성합니다.
4. 별도의 수동 JSON 편집 없이 `tools_schema`가 즉시 업데이트되어 OpenAI 호출에 반영됩니다.

## 4. 변경 시 검증 방법
- Python REPL에서 `from app.mcp.registry import tools_schema` 후 `print(json.dumps(tools_schema, indent=2, ensure_ascii=False))`로 확인합니다.
- 단위 테스트 예시:
  ```python
  from app.mcp.decorators import build_tool_schema
  from app.services.profile_service import fetch_company_profile

  def test_profile_tool_schema():
      schema = build_tool_schema(fetch_company_profile)
      params = schema["function"]["parameters"]
      assert params["required"] == ["ticker"]
  ```

## 5. 유지보수 체크리스트
- 새로운 의존성 파라미터를 추가할 때는 `build_tool_schema`의 제외 목록에 포함되어야 하는지 검토합니다.
- 복잡한 타입(중첩 리스트/딕셔너리 등)이 필요하면 `type_to_json_schema`를 확장해야 합니다.
- 서비스 함수 시그니처를 변경했다면, 관련 테스트 및 `tools_schema` 확인을 통해 즉시 검증합니다.
- `app/mcp/service.py`의 자동 의존성 주입 로직이 새로운 파라미터 이름을 처리하는지 확인합니다.

