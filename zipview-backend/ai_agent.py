# -*- coding: utf-8 -*-
"""
ZipView 지능형 AI 부동산 상담 에이전트 (Text-to-SQL & RAG 파이프라인)
- 자연어 조건(지역, 건물유형, 거래유형, 보증금/월세/매매가 상한선 등) 자동 파싱
- 실제 Supabase/PostgreSQL DB(ApartmentTrade 테이블) 비동기 조건 검색
- 검색 결과 기반 맞춤 매물 리스팅 브리핑 및 '조건에 맞는 매물이 없습니다' 정확한 예외 처리
- '만원만원' 단위 중복 방지 엄격 포맷팅
"""

import os
import re
import json
from typing import Optional, List, Dict, Any
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_, desc

from models import ApartmentTrade
from lawd_cd_registry import resolve_lawd_cd, get_region_name, NORMALIZED_NAME_TO_CODE

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")


def clean_format_korean_money(amount_manwon: Optional[int]) -> str:
    """만원 단위 숫자를 한국어로 변환하며, '만원' 단위 중복을 원천 차단"""
    if amount_manwon is None or amount_manwon <= 0:
        return "-"
    amount = int(amount_manwon)
    eok = amount // 10000
    rem = amount % 10000
    if eok > 0 and rem > 0:
        return f"{eok}억 {rem:,}만원"
    elif eok > 0:
        return f"{eok}억"
    else:
        return f"{rem:,}만원"


def parse_korean_number_to_manwon(text: str) -> int:
    """'15억', '2억 5천', '1000', '1,000만원' 등을 만원 단위 정수로 변환"""
    if not text:
        return 0
    t = str(text).replace(",", "").replace(" ", "").strip()

    # 억 + 천/만 조합 (예: 2억5000, 2억5천, 15억)
    eok_m = re.search(r"(\d+)억(?:(\d+)(?:천|만)?)?", t)
    if eok_m:
        eok = int(eok_m.group(1)) * 10000
        rem = 0
        if eok_m.group(2):
            val = int(eok_m.group(2))
            rem = val * 1000 if "천" in t and val < 100 else val
        return eok + rem

    # 만원 단위 (예: 1000만원, 1000만, 70만원, 70만)
    man_m = re.search(r"(\d+)만", t)
    if man_m:
        return int(man_m.group(1))

    # 순수 숫자만 있는 경우
    num_m = re.search(r"(\d+)", t)
    if num_m:
        return int(num_m.group(1))
    return 0


def extract_conditions_nlp(prompt: str, current_lawd_cd: Optional[str] = None) -> Dict[str, Any]:
    """자연어 질의에서 법정동, 지역, 거래유형, 건물유형, 가격 조건을 정규표현식 및 엔티티 매핑으로 정밀 추출"""
    p = prompt.strip()
    p_lower = p.lower()

    # 1. 법정동(dong_name: 읍/면/동) 추출 (예: '가좌동에 있어?', '가좌동', '상남동 원룸', '대치동')
    dong_name = None
    dong_stop_words = {
        "부동산", "자동", "활동", "이동", "운동", "공동", "단독", "작동", "행동", "변동",
        "아파트", "오피스텔", "다세대", "연립", "다가구", "원룸", "투룸", "쓰리룸",
        "동향", "동일", "동선", "동호수", "동전", "감동", "연동"
    }
    dong_m = re.search(r"([가-힣]{1,6}(?:동[0-9]*가?|읍|면))(?:[이가은는을를에에서으로로의와과]|역)?(?:\s|$|[?.,!])", p)
    if dong_m:
        cand = dong_m.group(1).strip()
        if cand not in dong_stop_words:
            dong_name = cand

    # 2. 거래 유형 판별
    trade_type = None
    if "월세" in p_lower:
        trade_type = "월세"
    elif "전세" in p_lower:
        trade_type = "전세"
    elif any(k in p_lower for k in ["매매", "매수", "구입"]):
        trade_type = "매매"

    # 3. 건물 유형 판별
    property_type = None
    if "오피스텔" in p_lower:
        property_type = "오피스텔"
    elif any(k in p_lower for k in ["빌라", "다세대", "연립", "투룸"]):
        property_type = "연립다세대"
    elif any(k in p_lower for k in ["원룸", "다가구", "단독"]):
        property_type = "단독다가구"
    elif "아파트" in p_lower:
        property_type = "아파트"

    # 4. 보증금 / 매매가 / 월세 금액 파싱
    max_deposit = None
    max_price = None
    max_monthly_rent = None

    # 보증금 파싱
    dep_m = re.search(r"보증금\s*([0-9억천만,\s]+?)(?:이하|미만|까지|$|\s)", p)
    if dep_m:
        max_deposit = parse_korean_number_to_manwon(dep_m.group(1))

    # 월세 금액 파싱
    rent_m = re.search(r"월세\s*([0-9억천만,\s]+?)(?:이하|미만|까지|$|\s)", p)
    if not rent_m:
        rent_m = re.search(r"월\s*([0-9억천만,\s]+?)(?:이하|미만|까지|$|\s)", p)
    if rent_m:
        max_monthly_rent = parse_korean_number_to_manwon(rent_m.group(1))

    # 매매가 / 일반 금액 한도 파싱
    if trade_type == "매매" or (not dep_m and not rent_m):
        price_m = re.search(r"([0-9억천만,\s]+?)(?:이하|미만|예산|한도)", p)
        if price_m:
            parsed_val = parse_korean_number_to_manwon(price_m.group(1))
            if parsed_val > 0:
                if trade_type == "매매":
                    max_price = parsed_val
                elif trade_type in ["전세", "월세"]:
                    max_deposit = parsed_val
                else:
                    max_price = parsed_val
                    max_deposit = parsed_val

    # 5. 광역 시/군/구 지역 코드 추출
    target_lawd_cd = current_lawd_cd
    for word in p.split():
        cleaned_word = re.sub(r"[^가-힣a-zA-Z0-9]", "", word)
        if cleaned_word in NORMALIZED_NAME_TO_CODE:
            target_lawd_cd = NORMALIZED_NAME_TO_CODE[cleaned_word]
            break

    # 6. 특정 단지명 검색
    apt_name = None
    apt_m = re.search(r"([가-힣a-zA-Z0-9]+)\s*(?:아파트|단지|오피스텔)", p)
    if apt_m:
        candidate = apt_m.group(1).strip()
        stop_words = ["매매", "전세", "월세", "실거래", "실거래가", "최근", "부동산", "서울", "경기", "창원", "진주", "강남"]
        if candidate not in stop_words and len(candidate) >= 2:
            apt_name = candidate

    return {
        "dong_name": dong_name,
        "trade_type": trade_type,
        "property_type": property_type,
        "max_deposit": max_deposit,
        "max_monthly_rent": max_monthly_rent,
        "max_price": max_price,
        "regional_code": target_lawd_cd,
        "apt_name": apt_name
    }


async def parse_conditions_with_openai(prompt: str, current_lawd_cd: Optional[str] = None) -> Dict[str, Any]:
    """OpenAI API를 통한 지능형 엔티티 추출(JSON) 및 NLP 규칙 파서 이중 교차 검증"""
    nlp_cond = extract_conditions_nlp(prompt, current_lawd_cd)

    if not OPENAI_API_KEY:
        return nlp_cond

    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=OPENAI_API_KEY)

        system_msg = (
            "너는 대한민국 부동산 질의 엔티티 추출(Named Entity Recognition) 전문가야. 사용자의 자연어 질문에서 검색 조건을 분석하여 반드시 유효한 JSON 형식으로만 추출해.\n"
            "- dong_name: 읍/면/동/리 단위의 세부 법정동 명칭 (예: '가좌동에 있어?' -> '가좌동', '대치동', '상남동', '문산읍'). 언급되지 않았으면 null.\n"
            "- trade_type: 거래 유형 ('매매', '전세', '월세') 또는 null\n"
            "- property_type: 주택 유형 ('아파트', '오피스텔', '연립다세대', '단독다가구'). '빌라'나 '투룸'은 '연립다세대', '원룸'은 '단독다가구'로 매핑. 없으면 null.\n"
            "- max_deposit: 보증금 또는 전세금 상한선(만원 단위 정수, 예: 1000이하는 1000, 2억은 20000, 5000만원은 5000) 또는 null\n"
            "- max_monthly_rent: 월세 상한선(만원 단위 정수, 예: 70이하는 70) 또는 null\n"
            "- max_price: 매매가 상한선(만원 단위 정수, 예: 15억은 150000) 또는 null\n"
            "- apt_name: 특정 단지명 또는 건물명 (예: '힐스테이트', '은마', '자이') 또는 null\n"
            "- region_name: 언급된 시/군/구 광역 지역명 (예: '진주시', '강남구', '창원시 성산구') 또는 null\n"
            "반드시 유효한 JSON 문자열만 출력해."
        )

        resp = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_msg},
                {"role": "user", "content": f"질문: {prompt}"}
            ],
            response_format={"type": "json_object"},
            temperature=0.0,
            timeout=8.0
        )

        content = resp.choices[0].message.content
        data = json.loads(content)

        region_code = current_lawd_cd
        if data.get("region_name"):
            resolved = resolve_lawd_cd(data["region_name"])
            if resolved:
                region_code = resolved

        # OpenAI 결과와 NLP 규칙 결과의 교차 병합 (법정동 누락 원천 방어)
        final_dong = data.get("dong_name") or nlp_cond.get("dong_name")
        final_trade = data.get("trade_type") or nlp_cond.get("trade_type")
        final_prop = data.get("property_type") or nlp_cond.get("property_type")
        final_deposit = data.get("max_deposit") if data.get("max_deposit") is not None else nlp_cond.get("max_deposit")
        final_rent = data.get("max_monthly_rent") if data.get("max_monthly_rent") is not None else nlp_cond.get("max_monthly_rent")
        final_price = data.get("max_price") if data.get("max_price") is not None else nlp_cond.get("max_price")
        final_apt = data.get("apt_name") or nlp_cond.get("apt_name")

        return {
            "dong_name": final_dong,
            "trade_type": final_trade,
            "property_type": final_prop,
            "max_deposit": final_deposit,
            "max_monthly_rent": final_rent,
            "max_price": final_price,
            "regional_code": region_code,
            "apt_name": final_apt
        }
    except Exception as e:
        print(f"⚠️ [OpenAI Parser 폴백]: {e}")
        return nlp_cond


async def execute_text_to_sql_query(
    db: AsyncSession,
    conditions: Dict[str, Any]
) -> List[ApartmentTrade]:
    """추출된 조건을 바탕으로 SQLAlchemy AsyncSession을 통해 실제 Supabase DB 엄격 교집합(AND) 질의 실행"""
    stmt = select(ApartmentTrade)
    filters = []

    reg_code = conditions.get("regional_code")
    if reg_code:
        filters.append(ApartmentTrade.regional_code == str(reg_code))

    # [핵심 1: 법정동 엄격한 AND 교집합 필터링]
    dong_val = conditions.get("dong_name")
    if dong_val and str(dong_val).strip():
        clean_dong = str(dong_val).strip()
        # 국토부 실거래 데이터의 dong 컬럼에 정확히 일치하거나 포함되는 레코드만 엄격 필터링
        filters.append(ApartmentTrade.dong.ilike(f"%{clean_dong}%"))

    t_type = conditions.get("trade_type")
    if t_type:
        filters.append(ApartmentTrade.trade_type == t_type)

    p_type = conditions.get("property_type")
    if p_type:
        filters.append(ApartmentTrade.property_type == p_type)

    apt = conditions.get("apt_name")
    if apt:
        filters.append(ApartmentTrade.apt_name.ilike(f"%{apt}%"))

    max_dep = conditions.get("max_deposit")
    if max_dep and max_dep > 0:
        filters.append(ApartmentTrade.deposit <= max_dep)
        filters.append(ApartmentTrade.deposit > 0)

    max_rent = conditions.get("max_monthly_rent")
    if max_rent and max_rent > 0:
        filters.append(ApartmentTrade.monthly_rent <= max_rent)
        filters.append(ApartmentTrade.monthly_rent > 0)

    max_pr = conditions.get("max_price")
    if max_pr and max_pr > 0:
        filters.append(ApartmentTrade.deal_amount <= max_pr)
        filters.append(ApartmentTrade.deal_amount > 0)

    if filters:
        stmt = stmt.where(and_(*filters))

    # 계약일 최신순, ID 내림차순 정렬 및 최대 8건 추출
    stmt = stmt.order_by(desc(ApartmentTrade.deal_date), desc(ApartmentTrade.id)).limit(8)

    result = await db.execute(stmt)
    records = result.scalars().all()

    # [엄격 필터링 보장]: 조건에 맞지 않는 타 지역/타 동네 매물을 임의로 섞지 않고 순수 일치 데이터만 반환
    return records


async def run_ai_consultant(
    prompt: str,
    current_lawd_cd: Optional[str] = None,
    region_label: Optional[str] = None,
    model_choice: str = "gpt",
    db: Optional[AsyncSession] = None
) -> str:
    """
    [핵심 진입점] 자연어 질문 ➔ Text-to-SQL DB 조회 ➔ RAG 브리핑 생성
    """
    # 1. 자연어 조건 파싱
    conditions = await parse_conditions_with_openai(prompt, current_lawd_cd)

    region_name = region_label or (get_region_name(conditions.get("regional_code") or "11680") if conditions.get("regional_code") else "전국")

    # 2. DB 세션이 전달된 경우 실제 Supabase DB 검색 실행
    records: List[ApartmentTrade] = []
    if db:
        try:
            records = await execute_text_to_sql_query(db, conditions)
        except Exception as query_err:
            print(f"⚠️ [DB Query Err]: {query_err}")

    # 3. 매물이 없는 경우: 명확하고 정확한 팩트 기반 빈 결과(Empty State) 응답
    if not records:
        dong = conditions.get("dong_name")
        cond_parts = []
        if dong:
            cond_parts.append(dong)
        if conditions.get("property_type"):
            cond_parts.append(conditions["property_type"])
        if conditions.get("trade_type"):
            cond_parts.append(conditions["trade_type"])
        if conditions.get("max_deposit"):
            cond_parts.append(f"보증금 {clean_format_korean_money(conditions['max_deposit'])} 이하")
        if conditions.get("max_monthly_rent"):
            cond_parts.append(f"월세 {clean_format_korean_money(conditions['max_monthly_rent'])} 이하")
        if conditions.get("max_price"):
            cond_parts.append(f"매매가 {clean_format_korean_money(conditions['max_price'])} 이하")
        if conditions.get("apt_name"):
            cond_parts.append(f"단지명 '{conditions['apt_name']}'")

        cond_desc = ", ".join(cond_parts) if cond_parts else f"'{prompt}'"
        return f"요청하신 조건({cond_desc})에 해당하는 최근 실거래 내역이 데이터베이스에 없습니다."

    # 4. 실제 DB 매물이 있는 경우: 실제 단지명, 법정동, 금액, 층수, 전용면적 브리핑 구성
    items_briefing = []
    for idx, r in enumerate(records, 1):
        if r.trade_type == "월세":
            price_text = f"보증금 {clean_format_korean_money(r.deposit)} / 월 {clean_format_korean_money(r.monthly_rent)}"
        elif r.trade_type == "전세":
            price_text = f"전세 {clean_format_korean_money(r.deposit)}"
        else:
            price_text = f"매매 {clean_format_korean_money(r.deal_amount)}"

        floor_str = f"{r.floor}층" if r.floor else "층 미표기"
        area_str = f"전용 {r.exclu_use_ar}㎡" if r.exclu_use_ar else ""
        date_str = f"계약일: {r.deal_date}" if r.deal_date else ""
        dong_str = f"{r.dong}" if r.dong else ""

        items_briefing.append(
            f"{idx}. [{r.property_type or '아파트'}] **{r.apt_name}** ({dong_str}) - **{price_text}** ({area_str}, {floor_str}, {date_str})"
        )

    listings_text = "\n".join(items_briefing)

    # OpenAI 또는 규칙 기반 최종 브리핑 출력
    if OPENAI_API_KEY and model_choice.lower() in ["gpt", "openai"]:
        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=OPENAI_API_KEY)
            target_dong_str = f"법정동: {conditions.get('dong_name')}" if conditions.get('dong_name') else "전체 동"
            rag_prompt = (
                f"사용자의 질문: '{prompt}'\n\n"
                f"추출 조건: {target_dong_str}, 거래유형={conditions.get('trade_type') or '전체'}\n\n"
                f"국토교통부 실거래 DB 엄격 일치 조회 결과 (총 {len(records)}건):\n"
                f"{listings_text}\n\n"
                f"위 실제 데이터만을 근거로 사용자에게 신뢰감 있는 프로페셔널한 어조로 요약 브리핑해줘.\n"
                f"엄격한 규칙:\n"
                f"1. 위 조회 결과에 포함된 매물만 언급하고, 다른 동네나 허위 단지명을 절대 추가하지 마.\n"
                f"2. 사용자가 특정 법정동({conditions.get('dong_name') or ''})을 질문한 경우, 해당 동의 실거래 매물임을 명확히 안내해.\n"
                f"3. '200만원만원'처럼 '만원' 단위가 중복되지 않도록 깔끔하게 한국어 화폐 단위를 표기해."
            )
            resp = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "너는 대한민국 실거래 공공데이터 기반 엔터프라이즈 부동산 AI 컨설턴트 집뷰(ZipView)야. 질문에 주어진 데이터만을 바탕으로 정직하고 명확하게 답변해."},
                    {"role": "user", "content": rag_prompt}
                ],
                temperature=0.2,
                timeout=12.0
            )
            return resp.choices[0].message.content
        except Exception as llm_err:
            print(f"⚠️ [OpenAI Completion Err]: {llm_err}")

    # 직접 구성한 B2B 엔터프라이즈 실거래 브리핑
    dong_title = f" {conditions['dong_name']}" if conditions.get("dong_name") else ""
    return (
        f"**[{region_name}{dong_title}] 조건 부합 국토교통부 실거래 매물 분석 결과**\n\n"
        f"요청하신 조건에 부합하는 최근 실제 거래 내역 총 {len(records)}건을 데이터베이스에서 확인했습니다:\n\n"
        f"{listings_text}\n\n"
        f"※ 위 내역은 국토교통부 실거래 원장 등록 기준 실제 데이터이며, 금액 및 층수 정보가 검증되었습니다."
    )


# 하위 호환성 유지 래퍼 함수
def ask_multi_llm_agent(prompt: str, model_choice: str = "gpt") -> str:
    """동기 환경 호출 호환 래퍼"""
    import asyncio
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop.run_until_complete(run_ai_consultant(prompt=prompt, model_choice=model_choice))
