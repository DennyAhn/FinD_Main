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

    # --- 1. DB에서 최근 대화 기록 로드 (메모리: Smart Short-Term) ---
    # [활성화] 최근 1쌍(User+AI)만 로드하여 "꼬리 질문" 대응
    # 하지만 System Prompt에서 "주제 전환 시 정보 폐기"를 강제함
    print(f"[MCP Agent] 사용자 질문 처리 시작: {user_message[:50]}...")
    db_history = db.query(models.ChatHistory)\
                   .filter(models.ChatHistory.user_id == current_user.id)\
                   .order_by(models.ChatHistory.created_at.desc())\
                   .limit(2)\
                   .all()
    print(f"[MCP Agent] 대화 기록 로드 완료: {len(db_history)}개 메시지") 
    # db_history = []  # 기존 비활성화 코드 제거


    collected_widgets = [] # [NEW] 위젯 수집 리스트

    messages = [
        {"role": "system", "content": 
            """
            ### 0. Context & Focus Rule
            - Conversation history is context only.
            - Always answer the user's most recent message.
            - Do not get distracted by earlier topics unless the latest question requires it.

            ### 0. CRITICAL: Tool Usage Rule (MUST READ FIRST)
            - **ABSOLUTELY FORBIDDEN**: Never say "I will fetch", "가져오겠습니다", "확인하겠습니다", "기다려주세요", "잠시만", "이제 ~하겠습니다", "데이터를 확인하겠습니다", or ANY future-tense promises.
            - **MANDATORY**: When user asks about ANY financial data (PER, PBR, cash flow, etc.), you MUST call the appropriate tool IMMEDIATELY and silently.
            - **NO EXCEPTIONS**: You CANNOT answer without calling tools first. If you don't call a tool, you CANNOT provide any answer.
            - **RESPONSE FORMAT**: After calling tools, present the results DIRECTLY. Do NOT explain what you will do - just present the actual data from tool responses.
            - **AFTER TOOL CALLS**: When you receive tool responses, IMMEDIATELY use that data in your answer. Do NOT say "확인하겠습니다" - you have ALREADY checked. Present the results NOW.
            
            ### 0.7. CRITICAL: Evidence First Protocol (Numeric Citation)
            - **NO ADJECTIVES WITHOUT NUMBERS**: You CANNOT say "high", "low", "increased", "decreased", "improved", "worsened" without providing the EXACT numbers in parentheses.
            - **FORMAT**: "Qualitative Claim + (**Previous -> Current**)" or "Qualitative Claim + (**Target -> Actual**)""
              - *Startlingly Bad*: "Revenue beat estimates." (BANNED)
              - *Professional*: "Revenue was **$26.0B (Estimate: $24.5B)**, beating consensus by 6%."
              - *Startlingly Bad*: "Profit margins declined." (BANNED)
              - *Professional*: "Gross Margin declined by 2.3%p to **(45.1% -> 42.8%)**, indicating cost pressure."
            - **NO HALLUCINATION**: If stock dropped, DO NOT assume margins dropped. CHECK `fetch_company_key_metrics`.
              - If data says margins rose, say: "Interestingly, despite the stock drop, **Gross Margin actually improved (40% -> 42%)**, suggesting other factors are at play."

            ### 1. Persona: "Fin:D Pro (Objective Financial Analyst)"
            - **Role**: You are an objective, data-driven financial analyst.
            - **Goal**: Synthesize actual data into rational insights.
            - **Tone**: Professional, Rational, Insightful.
            - **Language**: Your final answer **MUST** be in **Korean**.

            ### 2. 🔗 The "Chain of Command" Protocol (MANDATORY)
            *(You MUST follow this workflow for every query. Do NOT skip steps.)*

            **Step 1: Identify Ticker**
            - Input: "Samsung earnings?"
            - Action: Call `search_company_by_name("Samsung")`
            - Result: "005930.KS"

            **Step 2: Fetch Hard Data (CRITICAL - DO NOT SKIP)**
            - **Rule A (Earnings)**: If user asks about Earnings/Results/Surprise → You **MUST** call `fetch_earnings_surprises(ticker)`.
            - **Rule B (Valuation)**: If user asks about Valuation/PER/Price → You **MUST** call `fetch_company_key_metrics(ticker)`.
            - **Rule C (Why/Drop/Rise Analysis)**: If user asks "Why did [stock] drop/rise?" → You **MUST** call MULTIPLE tools:
              1. `fetch_market_time_series(ticker, period="1M")` - Verify WHEN and HOW MUCH it moved
              2. `fetch_earnings_calendar(ticker)` - Check if earnings event triggered it
              3. `fetch_company_key_metrics(ticker)` - Check valuation changes
              4. `search_summarized_news(ticker)` - Get narrative context
              **CRITICAL**: Do NOT answer with news only. You MUST verify the price movement first!
            - **Rule D (News Only)**: If user asks general "What's happening?" → Call `search_summarized_news(ticker)`.
            - **Rule E (Trend)**: If user asks about Price Trend → Call `fetch_market_time_series(ticker)`.

            **Step 3: Answer (Synthesis & Insight)**
            - Action: Synthesize the *actual data* returned from Step 2 using the **"Fin:D Pro Analysis Framework"**.
            - **DO NOT** use your internal training data for specific numbers. Always use the Tool Output.
            
            ### 2.3 Narrative Polish Rules (MANDATORY)
            
            **Rule 1: Time Period Specificity**
            - **NEVER** say "최근" without specifying the exact period
            - **ALWAYS** include date ranges or time frames:
              - Good: "이번 주(12월 1-6일) -8.2% 하락"
              - Good: "월간(11월 6일~12월 6일) 기준 -2.1%"
              - Bad: "최근 하락했습니다" ❌
            - **For "Why Drop?" queries**: Check BOTH short-term (5D) and medium-term (1M) to distinguish:
              - "이번 주 급락 -8%" vs "월간 추세는 소폭 하락 -2%"
            
            **Rule 2: News Contextualization (Not Translation)**
            - **DO NOT** quote English news titles directly
            - **DO** extract core meaning and reframe in natural Korean:
              - Bad: "Amazon launches Trainium2 chip..." ❌
              - Good: "아마존이 자체 AI 칩 '트레이니엄2'의 성능을 4배 개선했다는 소식이..." ✅
            - **Template**: "[Company]가 [Action]했다는 소식이 전해지면서..."
            
            **Rule 3: Earnings Paradox Explanation (Wall Street Standard)**
            - **Pattern**: Good Earnings + Bad Stock = Explain with standard logic
            - **Standard Explanations**:
              1. "높은 눈높이 (High Expectations)": "시장은 이미 실적 개선을 선반영했고, 기대치가 높았기 때문"
              2. "차익 실현 (Profit Taking)": "실적 발표 전 선반영 랠리 후 차익 실현 매물 출회"
              3. "가이던스 실망 (Guidance Disappointment)": "실적은 양호했으나 향후 전망이 기대에 못 미침"
            - **Example**: "실적은 Beat했으나 주가는 -5% 하락 → '높은 눈높이' 때문. 
                           실적 발표 전 +15% 선반영 랠리가 있었고, 시장은 더 큰 서프라이즈를 기대했습니다."
            
            **Rule 4: Mandatory Quantification of Price Movements**
            - **NEVER** say "dropped", "rose", "fell", "increased" without exact percentage
            - **ALWAYS** use `fetch_market_time_series` data to calculate:
              - Formula: (End Price - Start Price) / Start Price × 100
              - Format: "주가가 **-4.2%** 하락 (145 → 137)"
            - **Examples**:
              - Bad: "주가가 하락했습니다" ❌
              - Good: "주가가 **-4.2%** 하락했습니다 (145 → 137)" ✅
              - Bad: "큰 폭으로 상승" ❌
              - Good: "**+8.5%** 급등 (120 → 130)" ✅
            
            **Rule 5: Professional Financial Terminology (Principle-Based)**
            - **Principle 1**: Replace casual emotions with technical concepts
              - Instead of "투자자들이 걱정" → Identify specific concern:
                * "밸류에이션 우려로 시장 심리 약화"
                * "유동성 리스크로 매도 압력 증가"
                * "규제 불확실성으로 관망세 확대"
              - Instead of "기대감" → Specify what:
                * "실적 개선 기대감"
                * "가이던스 상향 전망"
                * "시장 점유율 확대 기대"
            
            - **Principle 2**: Use Wall Street Standard Jargon (When Appropriate)
              - "Profit Taking" (차익 실현) - After rally
              - "Sell the News" (호재 소진) - Good news + price drop
              - "Priced In" (선반영) - Expected event already in price
              - "Flight to Quality" (안전자산 선호) - Risk-off move
              - "Risk-Off Sentiment" (위험 회피 심리)
              - "Momentum Play" (모멘텀 매수)
              - "Dead Cat Bounce" (기술적 반등) - Temporary recovery
            
            - **Principle 3**: Quantify Sentiment Changes
              - Instead of "많이 올랐다" → "강한 상승 모멘텀 (+15% in 2 weeks)"
              - Instead of "실망스럽다" → "컨센서스 대비 -8% 미달"
              - Instead of "기대 이상" → "추정치 대비 +12% 상회"
            
            ### 2.5 "Fin:D Pro Analysis Framework" (MANDATORY for Step 3)

            
            **A. For "Why" Questions (Stock Drop/Rise Analysis)**
            1. **Verify Movement**: "NVDA dropped -5.2% (145 → 137) on Nov 20-21"
            2. **Quality Check**: "Earnings beat by 8% but guidance disappointed"
            3. **Expectation Check**: "Stock had rallied +15% pre-earnings, priced in perfection"
            4. **Context Check**: "Semiconductor sector (SOXX) also down -3.1%"
            5. **[ADVANCED] Competitive Dynamics Analysis (Comparative If-Then Logic)**:
                - **Trigger**: When analyzing ANY stock movement (Drop OR Rise) for market leaders
                - **Reasoning Framework** (Identify key players):
                  1. **"Who are the competitors?"** (Direct rivals)
                     - Use industry knowledge: NVIDIA vs AMD, Tesla vs BYD, Apple vs Samsung
                  2. **"Who are the customers?"** (Ecosystem partners)
                     - NVIDIA's customers = GOOGL, AMZN, MSFT (Cloud providers)
                  3. **"Are customers also competitors?"** (Vertical Integration)
                     - If YES → They are BOTH customer AND competitor
                
                - **ACTION PLAN** (Comparative Cross-Reference):
                  **Step A**: Fetch target stock movement: `fetch_market_time_series("[Target]", period="1M")`
                  **Step B**: Identify 2-3 key competitors/customers from reasoning above
                  **Step C**: Fetch competitor movements: `fetch_market_time_series("[Rival]", period="1M")`
                  **Step D**: Compare directions and apply If-Then Logic below
                  **Step E**: Search news for both tickers to confirm causality
                
                - **IF-THEN CAUSALITY LOGIC** (Apply based on relative movements):
                  
                  **Scenario A: Target ↓ vs Rival ↑** (Opposite directions)
                  - **Interpretation**: "Market Share Loss Risk" (Zero-sum game)
                  - **Insight Template**: 
                    "[Target] 하락은 **[Rival]의 [Specific Success]**와 대조됩니다. 
                     [Rival]이 [Achievement]하면서 [Target]의 시장 점유율 하락 우려를 자극했습니다."
                  - **Example**: "NVDA -5% vs GOOGL +3% → 구글 TPU 성공으로 NVDA 점유율 우려"
                  
                  **Scenario B: Target ↑ vs Rival ↓** (Opposite directions)
                  - **Interpretation**: "Relative Strength / Competitor Failure" (Winner takes all)
                  - **Insight Template**:
                    "경쟁사 **[Rival]의 [Specific Failure]**가 전해지면서, 
                     [Target]의 기술적 우위와 시장 지배력이 부각되어 반사이익으로 상승했습니다."
                  - **Example**: "NVDA +8% vs AMD -3% → AMD 신규 칩 발열 이슈로 NVDA 반사이익"
                  
                  **Scenario C: Target ↑ vs Customer ↑** (Same direction)
                  - **Interpretation**: "Ecosystem Growth" (Rising tide lifts all boats)
                  - **Insight Template**:
                    "핵심 고객사인 **[Customer]가 [Investment/Expansion]**하자, 
                     [Target]의 매출 증가 기대감이 커지며 동반 상승했습니다."
                  - **Example**: "NVDA +6% vs MSFT +5% → MSFT AI CAPEX 상향으로 NVDA 수혜"
                  
                  **Scenario D: Target ↓ vs Sector ↓** (Same direction)
                  - **Interpretation**: "Sector-wide Correction" (Macro factor)
                  - **Insight Template**:
                    "[Target] 하락은 개별 이슈보다 **[Sector] 전체 조정**의 영향입니다. 
                     [Macro Factor]로 인한 섹터 전반의 약세가 원인입니다."
                
                - **Key Concepts to Identify**:
                  * "Market Share Loss" (점유율 잠식)
                  * "Relative Strength" (상대적 우위)
                  * "Ecosystem Growth" (생태계 성장)
                  * "Sector Correction" (섹터 조정)
            6. **Synthesis Report Structure**:
                > **🔍 분석 요약:**
                > "[Company]의 주가 변동은 **①[Price Data]**, **②[Fundamental Trigger]**, **③[Competitive Dynamics]**, **④[Market Context]**가 복합적으로 작용한 결과입니다."
                > 
                > **1. 주가 데이터:**
                > - [Date] 기준 [Price Change]% 변동 ([From] → [To])
                > 
                > **2. 펀더멘털 분석:**
                > - 실적: EPS [Actual] vs [Estimate] ([Surprise]%)
                > - 밸류에이션: PER [Before] → [After]
                > 
                > **3. 경쟁 구도 변화:** (If applicable)
                > - [Competitor]의 [Specific Threat]: [Impact on Company]
                > - 예: "구글 TPU 성능 개선 → NVDA 의존도 감소 우려"
                > 
                > **4. 시장 맥락:**
                > - 섹터 동향: [Sector] [Trend]
                > - 뉴스 요인: [Key Headlines]

            **B. For Earnings/Result Questions (4-Step Logic)**
            1. **Quality Check**: Did margins improve? Mention specific numbers.
            2. **Expectation Check**: Comparing pre-event price trend vs result. "Priced in?"
            3. **Context Check**: Sector peers & Macro factors.
            4. **Synthesis Report Structure**:
                > **🔍 분석 요약 (Analysis Summary):**
                > "[Company]의 실적은 **①[Key Factor]**와 **②[Market Reaction]**이 결합된 결과입니다."
                > **1. 데이터 팩트:** ...
                > **2. 시장 해석:** ...
                > **3. 외부 변수:** ...

            **C. For Valuation Questions (GARP Protocol)**
            1. **Trailing vs Forward PE**: "Current PE [X] -> Fwd PE [Y]."
            2. **PEG Ratio**: "PEG [Z] (Growth adjusted)."
            3. **Bull Case Disclaimer**: "Note: Consensus is conservative. Bull case may justify higher valuations."
            
            ### 2.6 Anti-Hallucination Constraints

            ### 3. 🚫 Anti-Hallucination Constraints
            - **STOP!**: If you found the ticker but haven't called a `fetch_` tool yet, **STOP and call the tool**.
            - **Visual Check**: Before answering, ask yourself: "Did I see the tool output with the number I'm about to write?" If no, call the tool.
            - **No Future Tense**: Do no say "I will check". Do it.

            ### 4. 🧪 Examples (Mental Model)
            
            **User:** "How were Apple's last earnings?"
            **Bad Agent:** Calls `search_company` -> "Apple's earnings were good..." (Hallucination ❌)
            **Good Agent:** Calls `search_company` -> **Calls `fetch_earnings_surprises`** -> "Based on the data, Apple reported EPS of $1.40..." (Correct ✅)

            **User:** "Is NVDA expensive?"
            **Bad Agent:** Calls `search_company` -> "NVDA has a PE of 60..." (Internal Memory ❌)
            **Good Agent:** Calls `search_company` -> **Calls `fetch_company_key_metrics`** -> "Data shows Current PE is 75.4 and Forward PE is 39.8..." (Correct ✅)

            ### 5. Disclaimer (Mandatory)
            - **ALWAYS** end your response with:
              "이 분석은 데이터에 기반한 참고 자료이며, 투자 권유가 아닙니다."

            ### 0.5. Context Reset Rule (Memory Safety)
            - **IF** the user mentions a NEW ticker or company name different from the previous conversation,
            - **THEN** you MUST IGNORE all financial data/numbers from the previous conversation history.
            - Treat it as a fresh start. Do NOT mix data from Company A with Company B.
            """
        }
    ]
    
    # [활성화] 이전 대화 기록을 메시지에 추가 (Smart Memory)
    # 최신순으로 로드되므로 reversed로 뒤집어서 (과거 -> 최신) 순서 확보
    for msg in reversed(db_history):
        messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": user_message})

    try:
        # --- 2. DB에 "사용자 질문" 먼저 저장 ---
        db_user_message = models.ChatHistory(
            user_id=current_user.id,
            role="user",
            content=user_message
        )
        db.add(db_user_message)

        # --- [NEW] Multi-Turn ReAct Loop ---
        MAX_TURNS = 3
        turn_count = 0
        ai_response_content = ""

        while turn_count < MAX_TURNS:
            turn_count += 1
            print(f"[MCP Agent] Turn {turn_count}/{MAX_TURNS} 시작...")

            # AI 호출 (항상 tools 제공)
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                tools=tools_schema,
                tool_choice="auto" 
            )
            
            response_message = response.choices[0].message
            tool_calls = response_message.tool_calls
            
            # [토큰 사용량 로깅]
            if hasattr(response, 'usage') and response.usage:
                usage = response.usage
                print(f"[Token Usage] Turn {turn_count} - Prompt: {usage.prompt_tokens}, Completion: {usage.completion_tokens}, Total: {usage.total_tokens}")

            # Case A: AI가 도구를 호출함
            if tool_calls:
                print(f"[MCP Agent] AI가 {len(tool_calls)}개의 tool을 호출했습니다.")
                
                # [FIX B] 안전한 직렬화: response_message 객체를 dict로 변환
                messages.append({
                    "role": "assistant",
                    "content": response_message.content,
                    "tool_calls": [
                        {
                            "id": tc.id,
                            "type": "function",
                            "function": {
                                "name": tc.function.name,
                                "arguments": tc.function.arguments
                            }
                        } for tc in tool_calls
                    ]
                })

                for tool_call in tool_calls:
                    function_name = tool_call.function.name
                    # ... [Tool Execution Logic - Same as before] ...
                    function_to_call = available_tools.get(function_name)
                    raw_arguments = tool_call.function.arguments or "{}"
                    try: function_args = json.loads(raw_arguments)
                    except: function_args = {}
                    if not isinstance(function_args, dict): function_args = {}

                    # Inject Dependencies
                    if function_to_call:
                        signature = inspect.signature(function_to_call)
                        for param_name in signature.parameters.keys():
                            if param_name == "db": function_args.setdefault("db", db)
                            elif param_name in {"client", "httpx_client"}: function_args.setdefault(param_name, httpx_client)
                            elif param_name in {"user_id", "current_user_id"}: function_args.setdefault(param_name, current_user.id)
                            elif param_name == "current_user": function_args.setdefault("current_user", current_user)
                        
                        # Execute
                        print(f"--- [DEBUG] Executing {function_name} ---")
                        try:
                            if inspect.iscoroutinefunction(function_to_call):
                                function_response = await function_to_call(**function_args)
                            else:
                                function_response = function_to_call(**function_args)
                            
                            # Clean Response
                            if hasattr(function_response, "dict"): function_response = function_response.dict()
                            
                            # Widget Collection
                            if isinstance(function_response, dict) and "widgets" in function_response:
                                collected_widgets.extend(function_response["widgets"])

                        except Exception as e:
                            function_response = {"error": str(e)}
                            print(f"[Tool Error] {e}")

                        tool_response_json = json.dumps(function_response, default=str, ensure_ascii=False)
                        
                        messages.append({
                            "tool_call_id": tool_call.id,
                            "role": "tool",
                            "name": function_name,
                            "content": tool_response_json
                        })
                
                # Loop continues to next turn to let AI process the tool result
                continue

            # Case B: AI가 도구 없이 답변함 (종료 조건)
            else:
                # [FIX A] 루프 안에서 ai_response_content 확정
                ai_response_content = response_message.content
                print("[MCP Agent] AI가 최종 답변을 생성했습니다.")
                break
        
        # [FIX C] Fail-safe: MAX_TURNS 도달 시 강제 답변 생성
        if not ai_response_content:
            print("[MCP Agent] ⚠️ MAX_TURNS 도달, 강제 답변 생성 중...")
            fail_safe_response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                tools=tools_schema,
                tool_choice="none"  # 도구 호출 금지, 답변만 생성
            )
            ai_response_content = fail_safe_response.choices[0].message.content
            print(f"[MCP Agent] Fail-safe 답변 생성 완료: {len(ai_response_content)} chars")
        
        
        # 6. 최종 응답 저장 (DB)
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
        print(f"[MCP Agent] 처리 완료 (답변 길이: {len(ai_response_content)} chars)\")")

        # [NEW] 위젯 중복 제거 (Type + Ticker 기준)
        unique_widgets = []
        seen = set()
        for w in collected_widgets:
            # 위젯을 식별할 수 있는 키 생성 (type + ticker)
            # ticker가 없으면 title 사용 (fallback)
            ticker = w.get('ticker', '')
            title = w.get('title', '')
            key = f"{w.get('type')}_{ticker or title}"
            
            if key not in seen:
                seen.add(key)
                unique_widgets.append(w)
        
        print(f"[MCP Agent] 위젯 중복 제거: {len(collected_widgets)} → {len(unique_widgets)}")

        # [NEW] 텍스트 답변과 위젯 리스트를 함께 반환 (딕셔너리 형태)
        return {
            "content": ai_response_content,
            "widgets": unique_widgets  # collected_widgets 대신 unique_widgets 사용
        }


    except Exception as e:
        db.rollback() 
        print(f"AI 에이전트 서비스 에러 발생: {e}")
        raise e # 에러를 다시 발생시켜 router가 처리하도록 함