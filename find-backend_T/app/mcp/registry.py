# app/mcp/registry.py (자동 스키마 생성 버전)
from __future__ import annotations

from typing import Callable, Dict, List, Tuple

from app.mcp.decorators import build_tool_schema, get_registered_tools

# 서비스 모듈을 임포트하여 @register_tool 데코레이터가 실행되도록 합니다.
from app.services import (  # noqa: F401
    balance_sheet_service,
    cash_flow_service,
    earnings_service,
    income_statement_service,
    insider_service,
    key_metrics_service,
    market_service,
    memory_service,
    news_service,
    profile_service,
    ratings_service,
    search_service,
    timeseries_service,
)


def generate_tool_config() -> Tuple[List[Dict[str, object]], Dict[str, Callable]]:
    tools_schema: List[Dict[str, object]] = []
    tool_function_map: Dict[str, Callable] = {}

    for func in sorted(get_registered_tools(), key=lambda f: f.__name__):
        tools_schema.append(build_tool_schema(func))
        tool_function_map[func.__name__] = func

    return tools_schema, tool_function_map


tools_schema, available_tools = generate_tool_config()