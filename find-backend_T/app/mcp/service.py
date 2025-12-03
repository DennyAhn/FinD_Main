# app/mcp/service.py
# MCP 에이전트의 핵심 로직(두뇌)을 담당합니다.

from typing import Dict, Any
import inspect
import json
import httpx
from openai import OpenAI
from sqlalchemy.orm import Session

from app.config import OPENAI_API_KEY
from app import models, schemas

# 1. 도구 등록소에서 도구 리스트와 매핑을 가져옵니다
from app.mcp.registry import tools_schema, available_tools
from app.services import ServiceError

# OpenAI 클라이언트 초기화
client = OpenAI(api_key=OPENAI_API_KEY)

async def run_mcp_agent(
    user_message: str,
    current_user: models.User,
    db: Session,
    httpx_client: httpx.AsyncClient
) -> Dict[str, Any]:
    """
    AI 에이전트의 전체 MCP 사이클을 실행합니다.
    1. 메모리 로드 -> 2. AI 1차 호출 -> 3. 도구 실행 -> 4. AI 2차 호출 -> 5. 메모리 저장
    """

    # --- 1. DB에서 최근 대화 기록 로드 (메모리) ---
    # [비활성화] 이전 질문 포함 비활성화
    # 최신 사용자-에이전트 1쌍만 유지하여 맥락을 최소화(질문, 답변 1개)
    print(f"[MCP Agent] 사용자 질문 처리 시작: {user_message[:50]}...")
    # db_history = db.query(models.ChatHistory)\
    #                .filter(models.ChatHistory.user_id == current_user.id)\
    #                .order_by(models.ChatHistory.created_at.desc())\
    #                .limit(2)\
    #                .all()
    # print(f"[MCP Agent] 대화 기록 로드 완료: {len(db_history)}개 메시지")
    db_history = []  # 빈 리스트로 설정하여 이전 대화 기록 비활성화

    collected_widgets = [] # [NEW] 위젯 수집 리스트

    messages = [
        {"role": "system", "content": 
            """
            ### 0. Context & Focus Rule
            - Conversation history is context only.
            - Always answer the user's most recent message.
            - Do not get distracted by earlier topics unless the latest question requires it.

            ### 0.5. CRITICAL: Tool Usage Rule (MUST READ FIRST)
            - **ABSOLUTELY FORBIDDEN**: Never say "I will fetch", "가져오겠습니다", "확인하겠습니다", "기다려주세요", "잠시만", "이제 ~하겠습니다", "데이터를 확인하겠습니다", or ANY future-tense promises.
            - **MANDATORY**: When user asks about ANY financial data (PER, PBR, cash flow, etc.), you MUST call the appropriate tool IMMEDIATELY and silently.
            - **NO EXCEPTIONS**: You CANNOT answer without calling tools first. If you don't call a tool, you CANNOT provide any answer.
            - **RESPONSE FORMAT**: After calling tools, present the results DIRECTLY. Do NOT explain what you will do - just present the actual data from tool responses.
            - **AFTER TOOL CALLS**: When you receive tool responses, IMMEDIATELY use that data in your answer. Do NOT say "확인하겠습니다" - you have ALREADY checked. Present the results NOW.
            - Example WRONG: "알파벳 Inc.의 티커는 GOOGL입니다. 이제 올해의 분기별 PER을 확인하겠습니다."
            - Example WRONG: "애플의 현금흐름 데이터를 확인하겠습니다."
            - Example CORRECT: [Call fetch_company_key_metrics(ticker="GOOGL", period="quarter") silently] → "알파벳(GOOGL)의 올해 분기별 PER은..."
            - Example CORRECT: [Call fetch_company_cash_flows(ticker="AAPL") silently] → "애플(AAPL)의 최근 현금흐름은..." [then present actual data]

            You are 'FIN:D', an expert **Wall Street** financial analyst AI assistant.
            Your mission is to help users understand complex financial data 
            and gain data-driven insights. 
            Your final answer **MUST** be in **Korean**.

            ### 1. Core Principle: "Tool-Based Answers"
            - You **MUST NOT** answer from your own knowledge.
            - All your answers **MUST** be based *only* on the real-time context 
              provided by the 'Tools' (DB or API results).
            - **CRITICAL**: When asked about financial data (PER, PBR, cash flow, etc.), 
              you **MUST** call the appropriate tool FIRST, then answer based on the tool's response.
            - **NEVER** say "I will fetch the data" or "잠시만 기다려 주세요" or "가져오겠습니다".
              Instead, **IMMEDIATELY** call the tool and use its results to answer.
            - **DO NOT** promise to fetch data - just fetch it silently using tools and then present the results.
            - When presenting data, state its source (e.g., "According to the DB...", 
              "As per the financial statements...") to build trust.

            ### 2. Persona: "Professional Copilot"
            - **Tone:** Be professional, accurate, and analytical, like a 
              Wall Street analyst.
            - **Clarity:** Simultaneously, be a friendly 'Copilot'. You **MUST** explain *what* the data means and *why* it is important, 
              especially complex financial terms (e.g., Cash Flow, EPS), 
              so a beginner can understand.

            ### 3. Core Mission 1: "Complex Inference (Why)"
            - When asked a complex "Why" question (e.g., "Why did the stock price drop?"),
              you **MUST** use *multiple* relevant tools simultaneously 
              (e.g., `search_summarized_news`, `fetch_analyst_ratings`, 
              `fetch_insider_trades`, `fetch_earnings_calendar`, `fetch_market_time_series`).
            - You must then 'merge' these contexts to provide a comprehensive, 
              analytical answer.

            ### 4. Core Mission 2: "Factual Lookup (What)"
            - When asked a simple "What" question (e.g., "What is the stock price?"),
              use the single best tool to answer immediately.
            - **CRITICAL**: Do NOT say "I will look it up", "Let me check", "확인하겠습니다", "이제 ~하겠습니다" - 
              just call the tool silently and present the results directly.
            - **FORBIDDEN PHRASES**: "확인하겠습니다", "가져오겠습니다", "이제 ~하겠습니다", "기다려주세요"
            - Example: User asks "NVDA PER 알려줘" → IMMEDIATELY call `fetch_company_key_metrics(ticker="NVDA")`
              → Present the PER value from the tool response → Do NOT say "가져오겠습니다" or "확인하겠습니다".

            ### 5. Core Constraint: "NO Financial Advice"
            - **CRITICAL:** You **MUST NOT** provide any financial advice. 
            - **DO NOT** say "You should buy this stock," "It's a good time to sell," or
              any prescriptive recommendations.
            - **ONLY** provide data, analysis, and interpretation of the facts 
              provided by your tools.
            - If you cannot find information using your tools, state clearly: 
              "I could not find that information in the database."

            ### 6. Valuation Metrics (PER/PBR)
            - When discussing PER, PBR, PEG, or other valuation ratios, ALWAYS use `fetch_company_key_metrics`.
            - The tool now returns enriched insights:
              * `current_pe`, `forward_pe`, `average_pe`, `change_vs_average_percent`
              * `peg_ratio`, `return_on_equity`, `price_to_book_ratio`, `enterprise_value_to_ebitda`
              * `dividend_yield`, `buyback_yield`, `shareholder_yield`, `valuation_quality`
            - **When the user asks for "quarterly PER", "올해 분기별 PER", etc., call the tool with `period="quarter"`**
            - **MANDATORY**: Present the summary PLUS key metrics:
              * PER 위치(최근/평균/Forward) + PEG 해석
              * ROE·PBR·EV/EBITDA 등 품질 지표
              * Dividend Yield / Buyback Yield / Shareholder Yield로 주주환원 평가
            - Explain what the numbers imply (e.g., "PEG 0.9 → 성장 대비 저평가", "Shareholder Yield 6% → 주주 환원 강함") instead of raw numbers only.
            - Avoid absolute advice like "buy/sell"; phrase as data-driven observations (“평균 대비 +20% 프리미엄”, “ROE 대비 높은 PER” 등).
            - Structure responses similar to:
              1) **밸류에이션 요약** (PER/Forward PER/PEG)
              2) **퀄리티 지표** (ROE, PBR, EV/EBITDA)
              3) **주주환원** (배당, 자사주 매입, Shareholder Yield)
              4) 필요 시 과거 기록(연도/분기) 언급

            ### 7. Cash Flow Analysis
            - When discussing cash flow, the `fetch_company_cash_flows` tool returns data in this structure:
              {
                "records": [...],  // Raw historical cash flow data
                "insights": {      // Analysis: operating_cash_flow, free_cash_flow, health_score, health_grade
                  "operating_cash_flow": {current, previous, average, change percentages},
                  "free_cash_flow": {current, previous, average, change percentages},
                  "health_score": ...,
                  "health_grade": "우수/양호/보통/주의",
                  "health_factors": [...]
                },
                "summary": "..."  // Pre-generated Korean summary with insights
              }
            - **ALWAYS** use the `summary` field when available - it provides comprehensive insights about cash flow health.
            - The `summary` includes: current cash flow values, trends, health assessment, and what each cash flow type means.
            - Present the `summary` naturally in your response, especially the "[인사이트]" section which explains what good/bad cash flow patterns mean.
            - Always end cash flow discussions with the insights from the summary to help users understand the company's financial health.

            ### 8. Ticker Resolution & Multi-Step Tool Calls
            - When the user provides a company name (in Korean or English) instead of a ticker, you MUST validate or resolve it using the `search_company_by_name` tool before calling other tools.
            - The `search_company_by_name` tool automatically handles Korean company names (e.g., "애플" → "Apple") and searches for the ticker symbol.
            - **CRITICAL**: After finding a ticker, IMMEDIATELY call the next required tool (e.g., `fetch_company_key_metrics`) in the SAME tool call cycle.
            - **FORBIDDEN**: Do NOT say "티커는 GOOGL입니다. 이제 PER을 확인하겠습니다" - instead, call BOTH tools (search + metrics) immediately and present all results together.
            - **RESPONSE PATTERN**: If you need to find ticker AND get data, call both tools in sequence, then present: "알파벳(GOOGL)의 올해 분기별 PER은..."
            - If the ticker cannot be confirmed after searching, clearly inform the user and request a precise ticker symbol or company name.
            - **IMPORTANT**: Always use the ticker symbol returned by `search_company_by_name` for subsequent tool calls (e.g., `fetch_company_key_metrics`, `fetch_company_profile`).
            """
        }
    ]
    # [비활성화] 이전 대화 기록을 메시지에 추가하지 않음
    # for msg in reversed(db_history):
    #     messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": user_message})

    try:
        # --- 2. DB에 "사용자 질문" 먼저 저장 ---
        db_user_message = models.ChatHistory(
            user_id=current_user.id,
            role="user",
            content=user_message
        )
        db.add(db_user_message)

        # --- 3. 1차 호출: AI에게 질문 + 도구 목록 전달 ---
        print("[MCP Agent] 1차 AI 호출 시작 (tool 선택)...")
        response = client.chat.completions.create(
            model="gpt-5-mini",
            messages=messages,
            tools=tools_schema,
            tool_choice="auto"
        )
        print("[MCP Agent] 1차 AI 호출 완료")

        # [토큰 사용량 로깅] 1차 호출
        if hasattr(response, 'usage') and response.usage:
            usage = response.usage
            print(f"[Token Usage] 1차 호출 - Prompt: {usage.prompt_tokens}, Completion: {usage.completion_tokens}, Total: {usage.total_tokens}")

        response_message = response.choices[0].message
        tool_calls = response_message.tool_calls

        # [디버깅] AI의 tool 호출 여부 확인
        if tool_calls:
            print(f"[MCP Agent] AI가 {len(tool_calls)}개의 tool을 호출했습니다:")
            for tc in tool_calls:
                print(f"  - {tc.function.name}: {tc.function.arguments[:100]}...")
        else:
            print("[MCP Agent] ⚠️ AI가 tool을 호출하지 않았습니다.")
            # 데이터 관련 질문인데 tool을 호출하지 않은 경우 경고
            data_keywords = ["per", "pbr", "roe", "roa", "현금", "재무", "분기", "quarterly", "quarter"]
            if any(keyword in user_message.lower() for keyword in data_keywords):
                print(f"[MCP Agent] ⚠️ 경고: 데이터 관련 질문인데 tool을 호출하지 않았습니다. 질문: {user_message[:100]}")

        # --- 4. AI가 "도구 사용"을 결정한 경우 ---
        if tool_calls:
            print(f"[MCP Agent] Tool 실행 단계 시작 ({len(tool_calls)}개 tool)")
            messages.append(response_message) 

            for tool_call in tool_calls:
                function_name = tool_call.function.name
                function_to_call = available_tools.get(function_name)
                raw_arguments = tool_call.function.arguments or "{}"
                try:
                    function_args = json.loads(raw_arguments)
                except json.JSONDecodeError:
                    function_args = {}
                if not isinstance(function_args, dict):
                    function_args = {}

                if function_to_call:
                    signature = inspect.signature(function_to_call)
                    for param_name in signature.parameters.keys():
                        if param_name == "db":
                            function_args.setdefault("db", db)
                        elif param_name in {"client", "httpx_client"}:
                            function_args.setdefault(param_name, httpx_client)
                        elif param_name in {"user_id", "current_user_id"}:
                            function_args.setdefault(param_name, current_user.id)
                        elif param_name == "current_user":
                            function_args.setdefault("current_user", current_user)

                    try:
                        if inspect.iscoroutinefunction(function_to_call):
                            function_response = await function_to_call(**function_args)
                        else:
                            function_response = function_to_call(**function_args)
                        
                        # [NEW] Pydantic 모델인 경우 dict로 변환
                        if hasattr(function_response, "model_dump"):
                            function_response = function_response.model_dump()
                        elif hasattr(function_response, "dict"):
                            function_response = function_response.dict()

                        # [디버깅] tool 반환값 로깅
                        print(f"[MCP Tool] {function_name} 반환값 타입: {type(function_response)}")
                        if isinstance(function_response, dict):
                            print(f"[MCP Tool] {function_name} 반환값 키: {list(function_response.keys())}")
                            if "records" in function_response:
                                print(f"[MCP Tool] {function_name} records 개수: {len(function_response.get('records', []))}")
                            if "insights" in function_response:
                                print(f"[MCP Tool] {function_name} insights: {function_response.get('insights') is not None}")
                            if "summary" in function_response:
                                print(f"[MCP Tool] {function_name} summary: {function_response.get('summary')[:100] if function_response.get('summary') else None}...")
                            
                            # [NEW] 위젯 데이터 수집
                            if "widgets" in function_response and isinstance(function_response["widgets"], list):
                                print(f"[MCP Tool] {function_name} 위젯 {len(function_response['widgets'])}개 발견 및 수집")
                                collected_widgets.extend(function_response["widgets"])

                    except ServiceError as exc:
                        function_response = {
                            "error": str(exc),
                            "status_code": exc.status_code,
                        }
                        print(f"[MCP Tool Error] {function_name}: {exc}")
                    except Exception as exc:  # pragma: no cover - 예기치 못한 예외
                        function_response = {
                            "error": f"도구 실행 중 오류가 발생했습니다: {exc}"
                        }
                        print(f"[MCP Tool Exception] {function_name}: {exc}")
                        import traceback
                        traceback.print_exc()

                    tool_response_json = json.dumps(function_response, default=str, ensure_ascii=False)
                    print(f"[MCP Tool] {function_name} JSON 길이: {len(tool_response_json)} bytes")
                    
                    messages.append({
                        "tool_call_id": tool_call.id,
                        "role": "tool",
                        "name": function_name,
                        "content": tool_response_json
                    })

            # 5. 2차 호출 (최종 답변)
            print("[MCP Agent] 2차 AI 호출 시작 (최종 답변 생성)...")
            # 2차 호출 시 추가 지시사항
            messages.append({
                "role": "system",
                "content": """
                CRITICAL REMINDER FOR FINAL RESPONSE:
                - You have ALREADY called the tools and received the data.
                - DO NOT say "확인하겠습니다", "가져오겠습니다", "이제 ~하겠습니다", or ANY future-tense promises.
                - PRESENT THE DATA DIRECTLY from the tool responses you just received.
                - Use the tool response data (especially 'summary' and 'insights' fields) to answer immediately.
                - Start your response with the actual data, not with promises about what you will do.
                - Example WRONG: "애플의 현금흐름 데이터를 확인하겠습니다."
                - Example CORRECT: "애플(AAPL)의 최근 현금흐름은..." [then present actual data from tool response]
                """
            })
            final_response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages
            )
            print("[MCP Agent] 2차 AI 호출 완료")
            
            # [토큰 사용량 로깅] 2차 호출
            if hasattr(final_response, 'usage') and final_response.usage:
                usage = final_response.usage
                print(f"[Token Usage] 2차 호출 - Prompt: {usage.prompt_tokens}, Completion: {usage.completion_tokens}, Total: {usage.total_tokens}")
            
            ai_response_content = final_response.choices[0].message.content
            print(f"[MCP Agent] 최종 답변 길이: {len(ai_response_content) if ai_response_content else 0} chars")
            if ai_response_content:
                print(f"[MCP Agent] 최종 답변 미리보기: {ai_response_content[:200]}...")
            
            # [토큰 사용량 요약]
            first_usage = response.usage if hasattr(response, 'usage') and response.usage else None
            second_usage = final_response.usage if hasattr(final_response, 'usage') and final_response.usage else None
            
            if first_usage and second_usage:
                total_prompt = first_usage.prompt_tokens + second_usage.prompt_tokens
                total_completion = first_usage.completion_tokens + second_usage.completion_tokens
                total_tokens = first_usage.total_tokens + second_usage.total_tokens
                print(f"[Token Usage] 총 사용량 - Prompt: {total_prompt}, Completion: {total_completion}, Total: {total_tokens}")

        # 6. AI가 도구 사용 없이 "단순 답변"을 결정한 경우
        else:
            ai_response_content = response_message.content
            # [토큰 사용량 요약] (도구 미사용 시)
            if hasattr(response, 'usage') and response.usage:
                usage = response.usage
                print(f"[Token Usage] 단순 답변 - Prompt: {usage.prompt_tokens}, Completion: {usage.completion_tokens}, Total: {usage.total_tokens}")

        # --- 7. DB에 "AI 답변" 저장 ---
        db_ai_message = models.ChatHistory(
            user_id=current_user.id,
            role="assistant",
            content=ai_response_content
        )
        db.add(db_ai_message)

        db.commit() # 질문+답변을 한 번에 커밋
        print(f"[MCP Agent] 처리 완료 (답변 길이: {len(ai_response_content)} chars)")

        # [NEW] 텍스트 답변과 위젯 리스트를 함께 반환 (딕셔너리 형태)
        return {
            "content": ai_response_content,
            "widgets": collected_widgets
        }

    except Exception as e:
        db.rollback() 
        print(f"AI 에이전트 서비스 에러 발생: {e}")
        raise e # 에러를 다시 발생시켜 router가 처리하도록 함