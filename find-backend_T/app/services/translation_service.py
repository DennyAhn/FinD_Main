from __future__ import annotations

"""텍스트 번역을 담당하는 서비스 모듈."""

import asyncio
import json
from typing import Any, Dict

from openai import OpenAI

from app.config import OPENAI_API_KEY

_client = OpenAI(api_key=OPENAI_API_KEY)

PROFILE_FIELDS_TO_TRANSLATE = ("description", "industry", "sector")


async def translate_company_profile(profile: Dict[str, Any]) -> Dict[str, str]:
    """
    기업 프로필 정보를 자연스러운 한국어로 번역합니다.

    반환 값은 한국어 문자열이 담긴 딕셔너리이며,
    번역 실패 시 빈 딕셔너리를 반환합니다.
    """
    candidates = {
        field: value
        for field, value in profile.items()
        if field in PROFILE_FIELDS_TO_TRANSLATE and isinstance(value, str) and value.strip()
    }

    if not candidates:
        return {}

    prompt = (
        "다음 기업 정보를 자연스럽고 전문적인 한국어로 번역해 주세요. "
        "JSON 형식으로만 응답하며, 키는 그대로 유지하세요. "
        "존재하지 않는 키는 추가하지 말고, 번역이 불가능한 값은 빈 문자열로 두세요.\n\n"
        f"{json.dumps(candidates, ensure_ascii=False)}"
    )

    def _call_openai() -> str:
        response = _client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "당신은 금융 데이터를 자연스럽게 번역하는 전문 번역가입니다. "
                    "항상 JSON 문자열만 반환하세요.",
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0,
        )
        # [토큰 사용량 로깅] 프로필 번역 API 호출
        if hasattr(response, 'usage') and response.usage:
            usage = response.usage
            print(f"[Token Usage] 프로필 번역 API - Prompt: {usage.prompt_tokens}, Completion: {usage.completion_tokens}, Total: {usage.total_tokens}")
        return response.choices[0].message.content or ""

    try:
        completion_text = await asyncio.to_thread(_call_openai)
        completion_text = completion_text.strip()
        if completion_text.startswith("```"):
            # 코드 블록 형태로 응답하는 경우 ```` 제거
            completion_text = completion_text.strip("`")
            completion_text = completion_text.split("\n", 1)[-1]
        translated = json.loads(completion_text)
        if isinstance(translated, dict):
            return {k: str(v) for k, v in translated.items() if isinstance(v, str)}
        return {}
    except Exception as exc:  # pragma: no cover - 번역 실패 시 로깅 후 빈 dict
        print(f"translate_company_profile 실패: {exc}")
        return {}

