import json
from types import SimpleNamespace
from unittest.mock import AsyncMock

import httpx
import pytest

import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parents[2] / "zipview-backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import ai_agent


@pytest.mark.asyncio
async def test_gemini_request_keeps_api_key_server_side(monkeypatch):
    monkeypatch.setattr(ai_agent, "GEMINI_API_KEY", "test-key")
    seen = {}

    def handler(request):
        seen["url"] = str(request.url)
        seen["key_header"] = request.headers.get("x-goog-api-key")
        seen["body"] = json.loads(request.content)
        return httpx.Response(
            200,
            json={"candidates": [{"content": {"parts": [{"text": "ok"}]}}]},
        )

    real_async_client = httpx.AsyncClient
    transport = httpx.MockTransport(handler)
    monkeypatch.setattr(
        httpx,
        "AsyncClient",
        lambda **kwargs: real_async_client(transport=transport, **kwargs),
    )

    result = await ai_agent._generate_gemini_text("hello")

    assert result == "ok"
    assert seen["url"].endswith("/models/gemini-3.8-flash:generateContent")
    assert seen["key_header"] == "test-key"
    assert seen["body"]["contents"][0]["parts"][0]["text"] == "hello"


@pytest.mark.asyncio
async def test_gemini_retries_a_free_fallback_model_after_503(monkeypatch):
    monkeypatch.setattr(ai_agent, "GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(ai_agent, "GEMINI_MODEL", "gemini-3.8-flash")
    monkeypatch.setattr(ai_agent, "GEMINI_FALLBACK_MODELS", ["gemini-3.7-flash"])
    requested_models = []

    def handler(request):
        requested_models.append(request.url.path.rsplit("/models/", 1)[-1])
        if "gemini-3.8-flash" in request.url.path:
            return httpx.Response(503, json={"error": {"message": "temporary overload"}})
        return httpx.Response(
            200,
            json={"candidates": [{"content": {"parts": [{"text": "fallback ok"}]}}]},
        )

    real_async_client = httpx.AsyncClient
    transport = httpx.MockTransport(handler)
    monkeypatch.setattr(
        httpx,
        "AsyncClient",
        lambda **kwargs: real_async_client(transport=transport, **kwargs),
    )

    result = await ai_agent._generate_gemini_text("hello")

    assert result == "fallback ok"
    assert requested_models == ["gemini-3.8-flash:generateContent", "gemini-3.7-flash:generateContent"]


@pytest.mark.asyncio
async def test_gemini_choice_uses_gemini_for_condition_extraction(monkeypatch):
    monkeypatch.setattr(ai_agent, "GEMINI_API_KEY", "test-key")
    generate = AsyncMock(return_value=json.dumps({"trade_type": "매매", "property_type": "아파트"}))
    monkeypatch.setattr(ai_agent, "_generate_gemini_text", generate)

    result = await ai_agent.parse_conditions_with_openai(
        "강남구 아파트 매매",
        current_lawd_cd="11680",
        model_choice="gemini",
    )

    assert generate.await_count == 1
    assert generate.await_args.kwargs["response_mime_type"] == "application/json"
    assert result["trade_type"] == "매매"
    assert result["property_type"] == "아파트"
    assert result["regional_code"] == "11680"


@pytest.mark.asyncio
async def test_gemini_choice_uses_db_grounded_briefing(monkeypatch):
    monkeypatch.setattr(ai_agent, "GEMINI_API_KEY", "test-key")
    generate = AsyncMock(return_value="Gemini가 만든 DB 근거 브리핑")
    monkeypatch.setattr(ai_agent, "_generate_gemini_text", generate)
    trade = SimpleNamespace(
        trade_type="매매",
        deposit=0,
        monthly_rent=0,
        deal_amount=120000,
        floor=10,
        exclu_use_ar=84.9,
        deal_date="2026-09-01",
        dong="대치동",
        apt_name="테스트 아파트",
        property_type="아파트",
    )

    reply = await ai_agent._format_briefing_response(
        prompt="강남구 매매가 알려줘",
        region_name="서울특별시 강남구",
        conditions={"trade_type": "매매"},
        records=[trade],
        model_choice="gemini",
    )

    assert reply == "Gemini가 만든 DB 근거 브리핑"
    assert generate.await_count == 1
    assert "테스트 아파트" in generate.await_args.args[0]


@pytest.mark.asyncio
async def test_gemini_failure_is_visible_in_rule_based_fallback(monkeypatch):
    monkeypatch.setattr(ai_agent, "GEMINI_API_KEY", "test-key")
    generate = AsyncMock(side_effect=TimeoutError())
    monkeypatch.setattr(ai_agent, "_generate_gemini_text", generate)
    trade = SimpleNamespace(
        trade_type="매매",
        deposit=0,
        monthly_rent=0,
        deal_amount=120000,
        floor=10,
        exclu_use_ar=84.9,
        deal_date="2026-09-01",
        dong="대치동",
        apt_name="테스트 아파트",
        property_type="아파트",
    )

    reply = await ai_agent._format_briefing_response(
        prompt="강남구 매매가 알려줘",
        region_name="서울특별시 강남구",
        conditions={"trade_type": "매매"},
        records=[trade],
        model_choice="gemini",
    )

    assert generate.await_count == 1
    assert "Gemini 응답을 사용할 수 없어" in reply
    assert "테스트 아파트" in reply
