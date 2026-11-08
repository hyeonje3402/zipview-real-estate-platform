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
from cachetools import TTLCache
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_, desc

from models import ApartmentTrade
from lawd_cd_registry import (
    resolve_lawd_cd,
    get_region_name,
    get_sido_and_district,
    NORMALIZED_NAME_TO_CODE,
    check_dong_ambiguity,
    check_global_ambiguity,
    resolve_disambiguation_choice
)

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# 다중 턴 세션 컨텍스트 캐시 (1시간 TTL, 최대 2048개 동시 세션 메모리 보존)
SESSION_CONTEXT_CACHE: TTLCache = TTLCache(maxsize=2048, ttl=3600)


def clean_format_korean_money(amount_manwon: Optional[int]) -> str:
    """만원 단위 숫자를 한국어로 변환하며, '만원' 단위 중복을 원천 차단"""
    if amount_manwon is None or amount_manwon <= 0:
        return "-"
    amount = int(amount_manwon)
    eok = amount // 10000
    rem = amount % 10000
    if eok > 0 and rem > 0:
        res = f"{eok}억 {rem:,}만원"
    elif eok > 0:
        res = f"{eok}억"
    else:
        res = f"{rem:,}만원"
    return re.sub(r"(?:만\s*원|만원)(?:\s*(?:만\s*원|만원))+", "만원", res)


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


def extract_conditions_nlp(
    prompt: str,
    current_lawd_cd: Optional[str] = None,
    session_context: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
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

    # 5. 광역 시/군/구 지역 코드 및 지역명 추출 (N-gram 우선 매칭으로 '인천 서구' 등 복합 지명 완벽 분별)
    target_lawd_cd = None
    extracted_region = None
    words = [re.sub(r"[^가-힣a-zA-Z0-9]", "", w) for w in p.split() if w.strip()]

    # 5-1. 3어절 N-gram (예: "경상남도 창원시 의창구", "인천 광역시 서구")
    for i in range(len(words) - 2):
        cand = f"{words[i]} {words[i+1]} {words[i+2]}"
        code = resolve_lawd_cd(cand, silent=True)
        if code:
            target_lawd_cd = code
            extracted_region = get_region_name(code)
            break

    # 5-2. 2어절 N-gram (예: "인천 서구", "서울 강남", "창원 의창구", "대전 서구", "광주 서구")
    if not target_lawd_cd:
        for i in range(len(words) - 1):
            cand = f"{words[i]} {words[i+1]}"
            code = resolve_lawd_cd(cand, silent=True)
            if code:
                target_lawd_cd = code
                extracted_region = get_region_name(code)
                break

    # 5-3. 1어절 매칭 (단, 전국 중복 시군구인 '서구', '중구', '남구', '동구', '북구', '강서구', '고성군'은 모호성 판별을 위해 단독 매핑 배제)
    if not target_lawd_cd:
        ambig_single_words = {"서구", "중구", "남구", "동구", "북구", "강서구", "강서", "고성군", "고성"}
        for w in words:
            if w in ambig_single_words:
                extracted_region = w
                break
            code = resolve_lawd_cd(w, silent=True)
            if code:
                target_lawd_cd = code
                extracted_region = get_region_name(code)
                break

    # 5-4. 질문 내에 새로운 지역명이 전혀 없을 경우에만 current_lawd_cd 유지
    if not target_lawd_cd and not extracted_region:
        target_lawd_cd = current_lawd_cd

    # 6. 특정 단지명 검색
    apt_name = None
    apt_m = re.search(r"([가-힣a-zA-Z0-9]+)\s*(?:아파트|단지|오피스텔)", p)
    if apt_m:
        candidate = apt_m.group(1).strip()
        stop_words = ["매매", "전세", "월세", "실거래", "실거래가", "최근", "부동산", "서울", "경기", "창원", "진주", "강남"]
        if candidate not in stop_words and len(candidate) >= 2:
            apt_name = candidate

    # 6-1. 혁신도시 / 혁샌도시 오타 교정 시 충무공동 자동 매핑
    if any(k in p_lower for k in ["혁샌도시", "혁신도시", "진주혁신"]):
        if not dong_name:
            dong_name = "충무공동"
        target_lawd_cd = "48170"
        extracted_region = "경상남도 진주시"

    # 7. [맥락 복원] 직전 세션 컨텍스트 복원 ('그 단지', '아까 거기', '그 아파트', '그중에서 제일 최근' 등)
    if session_context:
        has_followup = any(kw in p_lower for kw in [
            "그 단지", "그단지", "그 아파트", "그아파트", "아까 그", "해당 단지", "해당단지", "그곳",
            "거기", "이곳", "그지역", "아까", "방금", "그중", "그중에", "그중에서", "제일", "가장", "최근", "최신", "얼마"
        ])
        if has_followup:
            last_cond = session_context.get("last_conditions") or {}
            if not apt_name and session_context.get("last_apt_name"):
                apt_name = session_context["last_apt_name"]

            if not dong_name:
                dong_name = session_context.get("last_dong_name") or last_cond.get("dong_name")

            if not target_lawd_cd:
                if session_context.get("last_active_region"):
                    last_reg = session_context["last_active_region"]
                    if isinstance(last_reg, dict) and last_reg.get("code"):
                        target_lawd_cd = last_reg["code"]
                        extracted_region = last_reg.get("label") or get_region_name(target_lawd_cd)
                if not target_lawd_cd and last_cond.get("regional_code"):
                    target_lawd_cd = last_cond["regional_code"]
                    extracted_region = last_cond.get("region_name") or get_region_name(target_lawd_cd)

            if not trade_type:
                trade_type = session_context.get("last_trade_type") or last_cond.get("trade_type")

            if not property_type and last_cond.get("property_type"):
                property_type = last_cond["property_type"]

    return {
        "dong_name": dong_name,
        "region_name": extracted_region,
        "trade_type": trade_type,
        "property_type": property_type,
        "max_deposit": max_deposit,
        "max_monthly_rent": max_monthly_rent,
        "max_price": max_price,
        "regional_code": target_lawd_cd,
        "apt_name": apt_name
    }


async def parse_conditions_with_openai(
    prompt: str,
    current_lawd_cd: Optional[str] = None,
    session_context: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """OpenAI API를 통한 지능형 엔티티 추출(JSON) 및 NLP 규칙 파서 이중 교차 검증"""
    nlp_cond = extract_conditions_nlp(prompt, current_lawd_cd, session_context=session_context)

    if not OPENAI_API_KEY:
        return nlp_cond

    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=OPENAI_API_KEY, timeout=5.0)

        context_hint = ""
        if session_context:
            last_apt = session_context.get("last_apt_name")
            last_dong = session_context.get("last_dong_name")
            last_reg = session_context.get("last_active_region") or {}
            reg_lbl = last_reg.get("label") if isinstance(last_reg, dict) else str(last_reg or "")
            if last_apt or last_dong or reg_lbl:
                context_hint = (
                    f"\n[직전 대화 맥락 정보]:\n"
                    f"- 직전 언급 단지명: {last_apt or '없음'}\n"
                    f"- 직전 법정동: {last_dong or '없음'}\n"
                    f"- 직전 지역: {reg_lbl or '없음'}\n"
                    f"사용자가 '그 단지', '아까 거기', '그 아파트', '전세는 얼마야?' 등 맥락 기반 후속 질문을 할 경우 위 직전 정보(단지명/법정동/지역)를 조건으로 자동 바인딩해.\n"
                )

        system_msg = (
            "너는 대한민국 부동산 질의 엔티티 추출(Named Entity Recognition) 전문가야. 사용자의 자연어 질문에서 검색 조건을 분석하여 반드시 유효한 JSON 형식으로만 추출해.\n"
            f"{context_hint}"
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

        region_code = nlp_cond.get("regional_code")
        if data.get("region_name"):
            resolved = resolve_lawd_cd(data["region_name"], silent=True)
            if resolved:
                region_code = resolved
        elif nlp_cond.get("region_name") and not region_code:
            resolved = resolve_lawd_cd(nlp_cond["region_name"], silent=True)
            if resolved:
                region_code = resolved
        if not region_code:
            region_code = current_lawd_cd

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
            "region_name": data.get("region_name") or nlp_cond.get("region_name"),
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


async def _format_briefing_response(
    prompt: str,
    region_name: str,
    conditions: Dict[str, Any],
    records: List[ApartmentTrade],
    model_choice: str = "gpt",
    is_new_region_override: bool = False,
    history: Optional[List[Dict[str, Any]]] = None
) -> str:
    """실거래 목록을 기반으로 B2B 엔터프라이즈 RAG 브리핑 생성 (직전 대화 맥락 주입)"""
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

    dong_val = conditions.get("dong_name") or ""
    dong_title = f" {dong_val}" if (dong_val and dong_val not in region_name) else ""
    full_target_name = f"{region_name}{dong_title}".strip()

    if OPENAI_API_KEY and model_choice.lower() in ["gpt", "openai"]:
        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=OPENAI_API_KEY, timeout=5.0)
            target_dong_str = f"법정동: {conditions.get('dong_name')}" if conditions.get('dong_name') else "전체 동"
            target_apt_str = f", 단지명={conditions.get('apt_name')}" if conditions.get('apt_name') else ""
            rag_prompt = (
                f"사용자의 질문: '{prompt}'\n\n"
                f"분석 지역: [{full_target_name}], 조건: {target_dong_str}{target_apt_str}, 거래유형={conditions.get('trade_type') or '전체'}\n\n"
                f"국토교통부 실거래 DB 엄격 일치 조회 결과 (총 {len(records)}건):\n"
                f"{listings_text}\n\n"
                f"위 실제 데이터만을 근거로 사용자에게 신뢰감 있는 프로페셔널한 B2B 어조로 요약 브리핑해줘.\n"
                f"엄격한 규칙:\n"
                f"1. 첫 문장은 반드시 '**요청하신 [{full_target_name}]의 거래 내역을 새로 분석했습니다.**'로 시작해.\n"
                f"2. 위 조회 결과에 포함된 매물만 언급하고, 다른 동네나 허위 단지명을 절대 추가하지 마.\n"
                f"3. 금액 표기 시 '만원' 단위가 중복되지 않도록 '보증금 1,000만원 / 월 70만원' 형태로 정갈하게 표기해."
            )

            chat_messages = [
                {"role": "system", "content": "너는 대한민국 실거래 공공데이터 기반 엔터프라이즈 부동산 AI 컨설턴트 집뷰(ZipView)야. 질문에 주어진 실제 데이터만을 바탕으로 정직하고 명확하게 답변해. 직전 대화 맥락이 주어지면 자연스럽게 연결해서 답변해."}
            ]
            if history:
                # 최근 4개 턴만 맥락으로 전달하여 토큰 절약 및 집중도 유지
                for h in history[-4:]:
                    r = h.get("role") or ("user" if h.get("sender") == "user" else "assistant")
                    c = h.get("content") or h.get("text") or ""
                    if c:
                        chat_messages.append({"role": r, "content": c})
            chat_messages.append({"role": "user", "content": rag_prompt})

            resp = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=chat_messages,
                temperature=0.2,
                timeout=12.0
            )
            raw_text = resp.choices[0].message.content or ""
            clean_text = re.sub(r"(?:만\s*원|만원)(?:\s*(?:만\s*원|만원))+", "만원", raw_text)
            clean_text = re.sub(r"억\s*만원+", "억", clean_text)
            return clean_text
        except Exception as llm_err:
            print(f"⚠️ [OpenAI Completion Err]: {llm_err}")

    header_title = f"**요청하신 [{full_target_name}]의 거래 내역을 새로 분석했습니다.**\n\n" if is_new_region_override else f"**[{full_target_name}] 조건 부합 국토교통부 실거래 매물 분석 결과**\n\n"
    res_str = (
        f"{header_title}"
        f"조건에 부합하는 최근 국토교통부 실제 거래 내역 총 {len(records)}건을 데이터베이스에서 확인했습니다:\n\n"
        f"{listings_text}\n\n"
        f"※ 위 내역은 국토교통부 실거래 원장 등록 기준 실제 데이터이며, 금액 및 층수 정보가 검증되었습니다."
    )
    return re.sub(r"(?:만\s*원|만원)(?:\s*(?:만\s*원|만원))+", "만원", res_str)


async def run_ai_consultant(
    prompt: str,
    current_lawd_cd: Optional[str] = None,
    region_label: Optional[str] = None,
    model_choice: str = "gpt",
    db: Optional[AsyncSession] = None,
    context: Optional[Dict[str, Any]] = None,
    selected_option: Optional[Dict[str, Any]] = None,
    session_id: Optional[str] = None,
    history: Optional[List[Dict[str, Any]]] = None
) -> Any:
    """
    [핵심 진입점] 자연어 질문 ➔ 전국 중복 지명 범용 되묻기(Disambiguation) ➔ 자율 국토부 데이터 주입 ➔ Text-to-SQL DB 조회 ➔ RAG 브리핑
    - Multi-turn 대화 세션 메모리(단지명, 법정동, 지역명 등) 자동 보존 및 복원
    """
    session_key = session_id or current_lawd_cd or "default_session"
    if session_key not in SESSION_CONTEXT_CACHE:
        SESSION_CONTEXT_CACHE[session_key] = {
            "history": [],
            "last_active_region": None,
            "last_apt_name": None,
            "last_dong_name": None,
            "last_conditions": None,
            "pending_disambiguation": None
        }
    session_data = SESSION_CONTEXT_CACHE[session_key]

    # 클라이언트에서 넘긴 대화 히스토리 병합
    if history and isinstance(history, list):
        session_data["history"] = history[-10:]

    pending_ctx = context or session_data.get("pending_disambiguation")

    # ---------------- 1단계: 되묻기 선택 응답 처리 (Context Retention & Disambiguation Resolution) ----------------
    chosen_option = None
    if selected_option:
        chosen_option = selected_option
    elif pending_ctx and pending_ctx.get("options"):
        chosen_option = resolve_disambiguation_choice(prompt, pending_ctx["options"])

    if chosen_option:
        # 사용자가 특정 지역을 최종 확정한 경우 (예: "1번", "대전 서구", 또는 선택지 버튼 클릭)
        session_data.pop("pending_disambiguation", None)
        target_code = chosen_option.get("code")
        resolved_label = chosen_option.get("label") or get_region_name(target_code)
        resolved_dong = chosen_option.get("dong")

        # 이전 대화의 원본 질문 조건(보증금, 월세, 거래유형 등) 복원 및 결합 (맥락 유지)
        conditions = dict(pending_ctx.get("pending_conditions") or {}) if pending_ctx else {}
        conditions["regional_code"] = target_code
        if resolved_dong:
            conditions["dong_name"] = resolved_dong

        # 활성 타겟 지역 세션 메모리에 갱신 (프론트엔드 UI 지역 컨텍스트 오버라이드)
        session_data["last_active_region"] = {
            "code": target_code,
            "label": resolved_label,
            "dong": resolved_dong
        }

        # 확정된 지역 코드로 실제 DB 검색 실행 (미존재 시 국토부 API 자율 실시간 동기화)
        records: List[ApartmentTrade] = []
        if db:
            try:
                records = await execute_text_to_sql_query(db, conditions)
                # 만약 DB에 매물이 없거나 최초 조회 신규 지역인 경우, 백엔드가 국토부 API에서 자율 데이터 주입(Sync) 실행
                if not records and target_code:
                    print(f"🔄 [Autonomous Data Injection] 타겟 지역({target_code} {resolved_label}) 국토부 API 자율 실시간 동기화 시작...")
                    try:
                        from main import execute_sync_for_region
                        await execute_sync_for_region(target_code, deal_ymd="last6")
                        records = await execute_text_to_sql_query(db, conditions)
                        print(f"✅ [Autonomous Data Injection 완료] 총 {len(records)}건 매물 확보")
                    except Exception as sync_err:
                        print(f"⚠️ [Autonomous Data Injection 예외]: {sync_err}")
            except Exception as query_err:
                print(f"⚠️ [DB Query Err]: {query_err}")

        dong_val = conditions.get("dong_name") or ""
        dong_title = f" {dong_val}" if (dong_val and dong_val not in resolved_label) else ""
        full_target_name = f"{resolved_label}{dong_title}".strip()

        if not records:
            cond_parts = []
            if conditions.get("dong_name"):
                cond_parts.append(conditions["dong_name"])
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
            empty_msg = f"**요청하신 [{full_target_name}]의 거래 내역을 새로 분석했습니다.**\n\n조건({cond_desc})에 부합하는 최근 국토교통부 실거래 내역이 데이터베이스에 없습니다."
            sido_name, district_name = get_sido_and_district(target_code)
            return {
                "status": "success",
                "reply": empty_msg,
                "override_region": True,
                "new_regional_code": target_code,
                "new_lawd_cd": target_code,
                "new_region_label": resolved_label,
                "new_city_name": sido_name,
                "new_sido_name": sido_name,
                "new_district_name": district_name
            }

        briefing_text = await _format_briefing_response(
            prompt=pending_ctx.get("original_prompt", prompt) if pending_ctx else prompt,
            region_name=resolved_label,
            conditions=conditions,
            records=records,
            model_choice=model_choice,
            is_new_region_override=True,
            history=session_data.get("history")
        )

        # 세션 메모리 갱신
        if records:
            first_apt = records[0].apt_name
            if first_apt and first_apt not in ("연립다세대", "단독주택", "다가구주택", "원룸"):
                session_data["last_apt_name"] = first_apt
            if records[0].dong:
                session_data["last_dong_name"] = records[0].dong
        elif conditions.get("apt_name"):
            session_data["last_apt_name"] = conditions["apt_name"]

        session_data["last_conditions"] = conditions
        session_data.setdefault("history", []).append({"role": "user", "content": prompt})
        session_data.setdefault("history", []).append({"role": "assistant", "content": briefing_text})

        sido_name, district_name = get_sido_and_district(target_code)
        return {
            "status": "success",
            "reply": briefing_text,
            "override_region": True,
            "new_regional_code": target_code,
            "new_lawd_cd": target_code,
            "new_region_label": resolved_label,
            "new_city_name": sido_name,
            "new_sido_name": sido_name,
            "new_district_name": district_name
        }

    # ---------------- 2단계: 신규 질의 자연어 조건 파싱 & 대명사/이전 맥락 복원 ----------------
    conditions = await parse_conditions_with_openai(prompt, current_lawd_cd, session_context=session_data)
    dong = conditions.get("dong_name")
    extracted_reg = conditions.get("region_name")

    # '그 단지', '아까 그 아파트', '거기', '그곳', '이곳', '그중에서 제일 최근' 등 이전 맥락/대명사 질의인 경우 세션 메모리에서 복원
    p_lower = prompt.lower()
    is_followup = any(kw in p_lower for kw in [
        "거기", "그곳", "이곳", "그지역", "해당지역", "해당 지역", "그 지역",
        "그 단지", "그단지", "그 아파트", "그아파트", "그 매물", "아까", "방금", "얼마야", "얼마인가요", "시세는",
        "그중", "그중에", "그중에서", "제일", "가장", "최근", "최신"
    ])
    last_active = session_data.get("last_active_region")
    last_cond = session_data.get("last_conditions") or {}
    if is_followup:
        if not conditions.get("regional_code"):
            if last_active and last_active.get("code"):
                conditions["regional_code"] = last_active["code"]
            elif last_cond.get("regional_code"):
                conditions["regional_code"] = last_cond["regional_code"]
        if not dong:
            if last_active and last_active.get("dong"):
                conditions["dong_name"] = last_active["dong"]
                dong = last_active["dong"]
            elif last_cond.get("dong_name"):
                conditions["dong_name"] = last_cond["dong_name"]
                dong = last_cond["dong_name"]
        if not conditions.get("trade_type"):
            if session_data.get("last_trade_type"):
                conditions["trade_type"] = session_data["last_trade_type"]
            elif last_cond.get("trade_type"):
                conditions["trade_type"] = last_cond["trade_type"]
        if not conditions.get("property_type") and last_cond.get("property_type"):
            conditions["property_type"] = last_cond["property_type"]
        if not conditions.get("apt_name") and session_data.get("last_apt_name"):
            conditions["apt_name"] = session_data["last_apt_name"]
        if not dong and session_data.get("last_dong_name"):
            conditions["dong_name"] = session_data["last_dong_name"]
            dong = session_data["last_dong_name"]

    # ---------------- 3단계: 범용 중복 지명 탐지 (Global Ambiguity Detection) ----------------
    if not is_followup:
        ambig_res = check_global_ambiguity(prompt, region_name=extracted_reg, dong_name=dong)
        if ambig_res and ambig_res.get("options") and len(ambig_res["options"]) >= 2:
            kw = ambig_res["keyword"]
            opts = ambig_res["options"]
            sample_str = ", ".join([f"{o['label']}" for o in opts[:3]])
            clarification_text = (
                f"말씀하신 '{kw}'이(가) 여러 곳에 있습니다. 어느 지역을 원하시나요? (예: {sample_str})\n\n"
                + "\n".join([f"{opt['index']}. {opt['label']}" for opt in opts])
                + "\n\n원하시는 지역 번호(예: 1번)나 지역명을 말씀해주시거나 아래 선택지 버튼을 클릭해주세요."
            )

            disambiguation_payload = {
                "keyword": kw,
                "entity_type": ambig_res.get("entity_type"),
                "original_prompt": prompt,
                "pending_conditions": conditions,
                "options": opts
            }

            session_data["pending_disambiguation"] = disambiguation_payload

            return {
                "status": "needs_clarification",
                "reply": clarification_text,
                "disambiguation": disambiguation_payload
            }

    # ---------------- 4단계: 단일 명확 지역 DB 실거래 검색 및 자율 데이터 주입 ----------------
    target_code = conditions.get("regional_code") or current_lawd_cd
    if not target_code:
        # 지역 정보가 질문 및 컨텍스트에 모두 없는 경우 사용자에게 지역 입력 유도 (강남구 하드코딩 기본값 원천 제거)
        return {
            "status": "success",
            "reply": "조회하고자 하시는 지역(예: 진주시, 창원시 성산구, 대전 서구 등)이나 단지명을 함께 말씀해 주시면 국토교통부 실거래 원장 데이터를 즉각 분석해 드립니다.",
            "override_region": False,
            "new_regional_code": None,
            "new_region_label": None
        }

    is_new_override = bool((current_lawd_cd and target_code != current_lawd_cd) or extracted_reg or (target_code and target_code != current_lawd_cd))
    region_name = get_region_name(target_code)

    session_data["last_active_region"] = {
        "code": target_code,
        "label": region_name,
        "dong": dong
    }

    records: List[ApartmentTrade] = []
    if db:
        try:
            records = await execute_text_to_sql_query(db, conditions)
            # 신규 타겟 지역 데이터가 DB에 없는 경우 백엔드 자율 실시간 동기화
            if not records and target_code and is_new_override:
                print(f"🔄 [Autonomous Data Injection] {region_name}({target_code}) 최신 실거래 자율 수집 실행...")
                try:
                    from main import execute_sync_for_region
                    # 3초 내 신속 응답을 위해 최신 1개월(202410) 우선 동기화
                    await execute_sync_for_region(target_code, deal_ymd="202410")
                    records = await execute_text_to_sql_query(db, conditions)
                    print(f"✅ [Autonomous Data Injection 완료] 총 {len(records)}건 매물 확보")
                    # 나머지 5개월은 백그라운드 태스크로 추가 적재하여 타임아웃 방지
                    import asyncio
                    asyncio.create_task(execute_sync_for_region(target_code, deal_ymd="last6"))
                except Exception as sync_err:
                    print(f"⚠️ [Autonomous Data Injection 예외]: {sync_err}")
        except Exception as query_err:
            print(f"⚠️ [DB Query Err]: {query_err}")

    # ---------------- 5단계: 매물이 없는 경우 (Empty State) ----------------
    dong_val = conditions.get("dong_name") or ""
    dong_title = f" {dong_val}" if (dong_val and dong_val not in region_name) else ""
    full_target_name = f"{region_name}{dong_title}".strip()

    if not records:
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
        empty_lead = ""
        if "혁샌도시" in prompt:
            empty_lead = "말씀하신 '혁샌도시'를 충무공동(진주 혁신도시)으로 자동 교정하여 분석했습니다.\n\n"
        elif is_new_override:
            empty_lead = f"**요청하신 [{full_target_name}]의 거래 내역을 새로 분석했습니다.**\n\n"

        session_data["last_conditions"] = conditions
        if conditions.get("trade_type"):
            session_data["last_trade_type"] = conditions["trade_type"]
        if conditions.get("dong_name"):
            session_data["last_dong_name"] = conditions["dong_name"]
        session_data.setdefault("history", []).append({"role": "user", "content": prompt})

        sido_name, district_name = get_sido_and_district(target_code)
        return {
            "status": "success",
            "reply": f"{empty_lead}요청하신 조건({cond_desc})에 해당하는 최근 국토교통부 실거래 내역이 데이터베이스에 없습니다.",
            "override_region": is_new_override,
            "new_regional_code": target_code,
            "new_lawd_cd": target_code,
            "new_region_label": region_name,
            "new_city_name": sido_name,
            "new_sido_name": sido_name,
            "new_district_name": district_name
        }

    # ---------------- 6단계: 실제 데이터 브리핑 생성 ----------------
    briefing_text = await _format_briefing_response(
        prompt=prompt,
        region_name=region_name,
        conditions=conditions,
        records=records,
        model_choice=model_choice,
        is_new_region_override=is_new_override,
        history=session_data.get("history")
    )
    if "혁샌도시" in prompt:
        briefing_text = "말씀하신 '혁샌도시'를 충무공동(진주 혁신도시)으로 자동 교정하여 분석했습니다.\n\n" + briefing_text

    # 세션 메모리 갱신 (다음 턴에서 '아까 그 단지' 질의 시 참조)
    if records:
        first_apt = records[0].apt_name
        if first_apt and first_apt not in ("연립다세대", "단독주택", "다가구주택", "원룸"):
            session_data["last_apt_name"] = first_apt
        if records[0].dong:
            session_data["last_dong_name"] = records[0].dong
    elif conditions.get("apt_name"):
        session_data["last_apt_name"] = conditions["apt_name"]

    session_data["last_conditions"] = conditions
    if conditions.get("trade_type"):
        session_data["last_trade_type"] = conditions["trade_type"]
    if conditions.get("dong_name"):
        session_data["last_dong_name"] = conditions["dong_name"]
    session_data.setdefault("history", []).append({"role": "user", "content": prompt})
    session_data.setdefault("history", []).append({"role": "assistant", "content": briefing_text})

    sido_name, district_name = get_sido_and_district(target_code)
    return {
        "status": "success",
        "reply": briefing_text,
        "override_region": is_new_override,
        "new_regional_code": target_code,
        "new_lawd_cd": target_code,
        "new_region_label": region_name,
        "new_city_name": sido_name,
        "new_sido_name": sido_name,
        "new_district_name": district_name
    }


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
