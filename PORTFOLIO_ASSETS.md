# FinD 프로젝트 기술적 강점 상세 (포트폴리오용)

이 문서는 FinD 프로젝트(특히 Backend AI Agent 파트)의 아키텍처적 강점과 채용 담당자/면접관에게 어필할 수 있는 핵심 포인트(Key Selling Points)를 정리한 것입니다.

---

## 🚀 핵심 기술 역량 (Key Competencies)

### 1. 확장 가능한 AI 에이전트 아키텍처 (Scalable Agent Architecture)
> *"Decoupling Business Logic from AI Logic"*

*   **구현 내용**:
    *   Python의 `Decorators`(`@register_tool`) 패턴을 활용하여 비즈니스 로직과 AI 도구 등록 시스템을 완벽하게 분리했습니다.
    *   `mcp/registry.py`와 `services/*.py`로 이어지는 자동화된 도구 수집 파이프라인을 구축했습니다.
*   **어필 포인트**:
    *   "단순히 LangChain 같은 라이브러리에 의존한 것이 아니라, **Maintainability(유지보수성)**와 **Scalability(확장성)**를 고려하여 직접 도구 등록 시스템을 설계했습니다."
    *   "새로운 기능을 추가할 때 AI 에이전트 코드를 수정할 필요 없이, 서비스 함수에 데코레이터만 붙이면 즉시 AI가 사용할 수 있는 구조입니다."

### 2. 고성능 비동기 병렬 처리 및 캐싱 전략 (Async Concurrency & Caching)
> *"Optimizing Logic for Cost & Latency"*

*   **구현 내용**:
    *   **Cache-First Strategy**: DB(Local Cache) 조회 → 실패 시 외부 API 호출 → DB 적재(Write-Back) 흐름을 구현하여 API 비용을 절감하고 응답 속도를 비약적으로 높였습니다.
    *   **Async/Await Parallelism**: `asyncio.gather`를 사용하여 상호 의존성이 없는 4개 이상의 금융 API(`Key Metrics`, `Ratios`, `Quote`, `Estimates`)를 병렬로 동시 호출하여 Latency를 최소화했습니다.
*   **어필 포인트**:
    *   "외부 API 속도가 느린 문제를 해결하기 위해 **비동기 병렬 처리**를 도입하여 전체 응답 시간을 1/4 수준으로 단축했습니다."
    *   "무분별한 API 호출을 막기 위해 TTL(Time To Live) 기반의 **DB 캐싱 레이어**를 직접 설계하여 운영 비용을 최적화했습니다."

### 3. Server-Driven UI (SDUI) 기반 시스템 설계
> *"Full-Stack System Design"*

*   **구현 내용**:
    *   Backend가 단순히 JSON 데이터만 내려주는 것이 아니라, 데이터의 성격에 따라 적합한 시각화 위젯(`GaugeChart`, `Sparkline`, `Grid` 등)을 결정하여 클라이언트에 전달합니다 (`framework.py`).
    *   AI의 분석 결과가 텍스트에 그치지 않고, 동적인 UI 컴포넌트로 렌더링되도록 설계했습니다.
*   **어필 포인트**:
    *   "토스(Toss)나 에어비앤비 등 테크 기업에서 사용하는 **Server-Driven UI** 개념을 도입하여, 클라이언트 배포 없이도 서버 로직만으로 화면 구성을 동적으로 제어할 수 있는 유연한 구조를 만들었습니다."

### 4. ReAct 패턴의 커스텀 구현 (ReAct Pattern Implementation)
> *"Deep Understanding of LLM Internals"*

*   **구현 내용**:
    *   `Thought`(사고) → `Action`(도구 실행) → `Observation`(결과 관측) → `Response`(응답)로 이어지는 LLM의 ReAct Loop를 `app/mcp/service.py`에서 직접 제어했습니다.
    *   Hallucination(환각)을 방지하기 위해 System Prompt에 **"Tool-Based Answers"** 원칙을 강제하고, 데이터 근거가 없을 경우 답변을 거부하도록 제어했습니다.
*   **어필 포인트**:
    *   "라이브러리의 블랙박스에 의존하지 않고 에이전트 루프를 직접 구현함으로써, 토큰 사용량 모니터링, 에러 핸들링, 컨텍스트 관리를 정밀하게 제어할 수 있었습니다."

---

## 📝 면접 예상 질문 및 답변 가이드

**Q. 왜 LangChain을 쓰지 않고 직접 구현했나요?**
> A. "LangChain은 초기 프로토타입에는 좋지만, 프로덕션 레벨에서는 추상화가 너무 깊어 디버깅이 어렵고 커스터마이징에 한계가 있었습니다. 특히 금융 데이터 처리의 정확도와 토큰 비용 최적화를 위해서는 프롬프트와 컨텍스트를 100% 제어할 수 있는 직접 구현(Raw OpenAI API + Custom Logic) 방식이 더 적합하다고 판단했습니다."

**Q. API 병렬 호출 시 에러 처리는 어떻게 했나요?**
> A. "`asyncio.gather`의 `return_exceptions=True` 옵션을 활용하여, 4개의 API 중 하나가 실패하더라도 전체 프로세스가 죽지 않고 성공한 데이터만이라도 병합(Partial Success)하여 서비스가 지속되도록 설계했습니다."

**Q. Server-Driven UI를 도입하며 어려웠던 점은?**
> A. "백엔드에서 정의한 위젯 스키마(Pydantic Model)와 프론트엔드의 렌더링 컴포넌트 간의 타입을 일치시키는 것이 중요했습니다. 이를 위해 명확한 JSON 스키마를 정의하고, 백엔드에서 위젯 타입을 엄격하게 검증하여 내려주도록 구현했습니다."
