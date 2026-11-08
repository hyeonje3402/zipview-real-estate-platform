import os
import sys
from pathlib import Path
from unittest.mock import AsyncMock, patch, MagicMock
import pytest
from httpx import AsyncClient, ASGITransport

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent.parent / "zipview-backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from main import app, TRADES_CACHE, get_db
import ai_agent


@pytest.fixture(autouse=True)
def clean_cache_and_mock_external():
    """테스트 전후로 캐시를 초기화하고 외부 통신(MOLIT API, OpenAI 네트워크)을 격리"""
    TRADES_CACHE.clear()
    ai_agent.SESSION_CONTEXT_CACHE.clear()

    # 외부 국토부 API 및 LLM 네트워크 호출을 hermetic하게 모킹
    async def fake_parse_conditions(prompt, current_lawd_cd=None, session_context=None):
        return ai_agent.extract_conditions_nlp(prompt, current_lawd_cd=current_lawd_cd, session_context=session_context)

    async def fake_briefing(*args, **kwargs):
        return f"요청하신 {kwargs.get('region_name', '')} 실거래 분석 결과입니다."

    async def fake_fetch_trades(*args, **kwargs):
        return 0, 0

    with patch("ai_agent.parse_conditions_with_openai", side_effect=fake_parse_conditions), \
         patch("ai_agent._format_briefing_response", side_effect=fake_briefing), \
         patch("main.execute_sync_for_region", new_callable=AsyncMock), \
         patch("main.execute_sync_for_region_chunked", new_callable=AsyncMock):
        yield

    TRADES_CACHE.clear()
    ai_agent.SESSION_CONTEXT_CACHE.clear()


@pytest.mark.asyncio
async def test_chat_endpoint_contains_new_lawd_cd():
    """
    [필수 검증 시나리오 1]
    /api/chat 엔드포인트 호출 시 사용자가 '인천 서구 전세 찾아줘' 질의를 했을 때
    응답 페이로드에 'new_lawd_cd' (28260) 및 정규화된 시/도, 시/군/구가 포함되는지 검증
    """
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    mock_db.execute = AsyncMock(return_value=mock_result)
    app.dependency_overrides[get_db] = lambda: mock_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "prompt": "인천 서구 전세 찾아줘",
            "model_choice": "gpt"
        }
        response = await client.post("/api/chat", json=payload)
        assert response.status_code == 200, f"Response: {response.text}"
        data = response.json()

        # 1. 필수 검증 항목: new_lawd_cd 포함 여부
        assert "new_lawd_cd" in data, "응답에 new_lawd_cd 필드가 포함되어야 합니다."
        assert data["new_lawd_cd"] == "28260", f"인천 서구의 법정동 코드는 28260이어야 합니다. (실제: {data.get('new_lawd_cd')})"
        assert data["new_regional_code"] == "28260"
        assert data["override_region"] is True

        # 2. 정규화된 시/도 및 시/군/구 동기화 필드 검증
        assert data.get("new_city_name") == "인천광역시"
        assert data.get("new_district_name") == "서구"

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_trades_ttl_in_memory_cache_skips_db_query():
    """
    [필수 검증 시나리오 2]
    동일한 지역 코드 API를 2번 연속 호출했을 때,
    1시간 TTL 인메모리 캐시가 정상 작동하여 두 번째 호출에서는 데이터베이스 쿼리를 생략하는지 검증
    """
    mock_db = AsyncMock()
    mock_item = MagicMock(
        id=1,
        regional_code="28260",
        apt_name="청라더샵",
        dong="청라동",
        jibun="100",
        trade_type="매매",
        deal_amount=50000,
        deposit=0,
        monthly_rent=0,
        floor=15,
        exclu_use_ar=84.9,
        deal_year=2024,
        deal_month=10,
        deal_day=15,
        deal_date="2024-10-15",
        property_type="아파트"
    )

    def fake_execute(stmt, *args, **kwargs):
        s_str = str(stmt)
        res = MagicMock()
        res.scalar.return_value = 10
        res.scalars.return_value.all.return_value = [mock_item]

        if "avg_deposit" in s_str:
            # 6단계 차트 집계 쿼리 (6-tuple)
            res.all.return_value = [(2024, 10, "매매", 5, 50000, 0), (2024, 10, "전세", 3, 0, 30000)]
        elif "complex_stats" in s_str or "deal_count" in s_str or "avg_trade" in s_str or "avg_deal" in s_str:
            # 단지별 집계 쿼리 (7-tuple)
            res.all.return_value = [("청라더샵", "청라동", "아파트", 10, 50000, 30000, 84.9)]
        elif "b_name" in s_str:
            # 건물명 distinct 쿼리
            res.all.return_value = [("청라더샵",)]
        else:
            # 기본 연월 쌍 쿼리
            res.all.return_value = [(2024, 10), (2024, 9)]

        return res

    mock_db.execute = AsyncMock(side_effect=fake_execute)

    app.dependency_overrides[get_db] = lambda: mock_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        test_region = "28260"  # 인천 서구

        # 1회차 호출: 캐시 미스 -> DB 조회 발생
        res1 = await client.get(f"/api/trades/{test_region}?page=1&limit=20")
        assert res1.status_code == 200, f"1회차 호출 실패: {res1.text}"
        call_count_after_first = mock_db.execute.call_count
        assert call_count_after_first > 0, "1회차 호출 시에는 DB 조회가 실행되어야 합니다."

        # 캐시가 실제로 채워졌는지 확인 (1시간 TTL Cachetools)
        cache_keys = [k for k in TRADES_CACHE.keys() if k.startswith(f"{test_region}:")]
        assert len(cache_keys) > 0, "1회차 호출 후 TRADES_CACHE에 키가 등록되어야 합니다."

        # 2회차 호출: 동일한 지역 코드 및 파라미터로 즉시 재호출
        res2 = await client.get(f"/api/trades/{test_region}?page=1&limit=20")
        assert res2.status_code == 200, f"2회차 호출 실패: {res2.text}"

        # 핵심 검증: 2회차 호출에서는 mock_db.execute가 추가로 호출되지 않아야 함 (쿼리 생략!)
        call_count_after_second = mock_db.execute.call_count
        assert call_count_after_second == call_count_after_first, (
            f"캐시 적중 시 DB 쿼리가 생략되어야 합니다. "
            f"(1회차 누적: {call_count_after_first}, 2회차 누적: {call_count_after_second})"
        )

        # 1회차와 2회차의 데이터 응답이 완벽히 일치하는지 확인
        assert res1.json()["total_count"] == res2.json()["total_count"]

    app.dependency_overrides.clear()


@pytest.mark.asyncio
@pytest.mark.parametrize("prompt,expected_code,expected_sido,expected_dist", [
    ("제주 서귀포시 전세 찾아줘", "50130", "제주특별자치도", "서귀포시"),
    ("부산 해운대구 매매 알려줘", "26350", "부산광역시", "해운대구"),
    ("전남 여수시 아파트 보여줘", "46130", "전라남도", "여수시"),
    ("강원 춘천시 시세 분석해줘", "42110", "강원특별자치도", "춘천시")
])
async def test_nationwide_252_region_routing(prompt, expected_code, expected_sido, expected_dist):
    """
    [전국 252개 지역 범용 라우팅 무결성 검증]
    제주, 부산, 전남, 강원 등 전국 어디를 검색하든
    타깃 5자리 코드 및 시/도, 시/군/구가 정확히 추출되는지 파라미터화 검증
    """
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    mock_db.execute = AsyncMock(return_value=mock_result)
    app.dependency_overrides[get_db] = lambda: mock_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/chat", json={"prompt": prompt})
        assert res.status_code == 200
        data = res.json()
        assert data.get("new_lawd_cd") == expected_code
        assert data.get("new_regional_code") == expected_code
        assert data.get("new_city_name") == expected_sido
        assert data.get("new_district_name") == expected_dist

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_landmark_inference_and_lawd_cd_routing():
    """
    [극한 시나리오 1: 랜드마크 추론 및 모호성 검증]
    질의어로 "진주 남강 근처 싼 전세 찾아줘"를 전송했을 때,
    AI가 '남강' 랜드마크를 이해하고 응답 페이로드의 new_lawd_cd를 진주시(48170) 코드로 정확히 파싱하는지 검증
    """
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    mock_db.execute = AsyncMock(return_value=mock_result)
    app.dependency_overrides[get_db] = lambda: mock_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "prompt": "진주 남강 근처 싼 전세 찾아줘",
            "model_choice": "gpt"
        }
        res = await client.post("/api/chat", json=payload)
        assert res.status_code == 200, f"남강 질의 실패: {res.text}"
        data = res.json()

        assert data.get("status") == "success"
        assert data.get("new_lawd_cd") == "48170", f"남강 랜드마크는 진주시(48170)로 파싱되어야 합니다. (실제: {data.get('new_lawd_cd')})"
        assert data.get("new_regional_code") == "48170"
        assert data.get("new_city_name") == "경상남도"
        assert data.get("new_district_name") == "진주시"

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_session_memory_context_retention():
    """
    [극한 시나리오 3: 대화 맥락(Session Memory) 복원 테스트]
    1차 질의("진주 남강 근처 싼 전세 찾아줘") 이후 session_id를 유지한 채
    2차 질의("그중에서 제일 최근에 거래된 건?")를 연속으로 던졌을 때,
    AI가 직전의 지역(진주시 48170)과 거래 유형(전세) 컨텍스트를 상실하지 않고 유지하는지 검증
    """
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    mock_db.execute = AsyncMock(return_value=mock_result)
    app.dependency_overrides[get_db] = lambda: mock_db

    session_id = "test_stress_session_777"
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1차 질의: 진주 남강 전세 질의
        p1 = {
            "prompt": "진주 남강 근처 싼 전세 찾아줘",
            "session_id": session_id,
            "model_choice": "gpt"
        }
        res1 = await client.post("/api/chat", json=p1)
        assert res1.status_code == 200
        d1 = res1.json()
        assert d1.get("new_lawd_cd") == "48170"
        assert d1.get("new_district_name") == "진주시"

        # 2차 질의: 세션 ID 유지 후 지시대명사/후속 질의 전송
        p2 = {
            "prompt": "그중에서 제일 최근에 거래된 건?",
            "session_id": session_id,
            "model_choice": "gpt"
        }
        res2 = await client.post("/api/chat", json=p2)
        assert res2.status_code == 200, f"2차 후속 질의 실패: {res2.text}"
        d2 = res2.json()

        assert d2.get("status") == "success"
        # 직전 지역(진주시 48170) 및 거래유형(전세) 컨텍스트가 유지되어 동일한 new_lawd_cd 반환 확인
        assert d2.get("new_lawd_cd") == "48170", f"2차 질의에서도 진주시(48170) 컨텍스트가 유지되어야 합니다. (실제: {d2.get('new_lawd_cd')})"
        assert d2.get("new_regional_code") == "48170"
        assert d2.get("new_district_name") == "진주시"

        # 세션 컨텍스트 캐시에 직전 거래유형(전세)이 보존되어 있는지 직접 검증
        session_obj = ai_agent.SESSION_CONTEXT_CACHE.get(session_id, {})
        last_trade_type = session_obj.get("last_trade_type") or session_obj.get("last_conditions", {}).get("trade_type")
        assert last_trade_type == "전세", f"세션 메모리에 거래 유형 '전세'가 보존되어야 합니다. (실제: {last_trade_type})"

    app.dependency_overrides.clear()
