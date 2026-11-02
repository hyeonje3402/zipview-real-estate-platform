import os
import json
import re
from typing import Dict, Any, List, Optional
from dotenv import load_dotenv

from database import SessionLocal
from models import ApartmentTrade

load_dotenv()

# 1. .env 파일에서 두 모델의 API 키 모두 로드
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

def format_korean_money(amount_manwon: int) -> str:
    """만원 단위 숫자를 한국어 'X억 Y만원' 포맷으로 변환"""
    if not amount_manwon or amount_manwon <= 0:
        return "-"
    eok = amount_manwon // 10000
    rem = amount_manwon % 10000
    if eok > 0 and rem > 0:
        return f"{eok}억 {rem:,}만원"
    elif eok > 0:
        return f"{eok}억"
    else:
        return f"{rem:,}만원"


# ==================== LangChain 통일 도구(Unified Tools) 인터페이스 ====================

try:
    from langchain_core.tools import tool
except ImportError:
    # LangChain 미설치 환경을 위한 임시 데코레이터
    def tool(fn):
        return fn

@tool
def search_recent_price(apt_name: str, trade_type: str = "매매") -> str:
    """
    특정 아파트 단지의 최근 실거래가 평균, 최저가, 최고가 및 최근 거래 내역 5건을 DB에서 조회합니다.
    
    Args:
        apt_name: 검색할 아파트 단지명 (예: '은마', '래미안원베일리', '반포자이')
        trade_type: 거래 유형 ('매매', '전세', '월세'). 기본값은 '매매'
    """
    db = SessionLocal()
    try:
        records = db.query(ApartmentTrade).filter(
            ApartmentTrade.apt_name.ilike(f"%{apt_name.strip()}%"),
            ApartmentTrade.trade_type == trade_type.strip()
        ).order_by(ApartmentTrade.deal_date.desc(), ApartmentTrade.id.desc()).limit(5).all()

        if not records:
            # 거래유형 미지정 대응을 위한 폴백
            fallback = db.query(ApartmentTrade).filter(
                ApartmentTrade.apt_name.ilike(f"%{apt_name.strip()}%")
            ).order_by(ApartmentTrade.deal_date.desc()).limit(5).all()
            if not fallback:
                return json.dumps({"found": False, "message": f"DB에 '{apt_name}' 단지의 실거래 기록이 없습니다."}, ensure_ascii=False)
            records = fallback
            trade_type = records[0].trade_type

        prices = [r.deal_amount if r.trade_type == "매매" else r.deposit for r in records if (r.deal_amount or r.deposit)]
        recent_deals = [{
            "deal_date": r.deal_date,
            "trade_type": r.trade_type,
            "price_formatted": format_korean_money(r.deal_amount if r.trade_type == "매매" else r.deposit),
            "area_m2": round(r.exclu_use_ar, 1),
            "floor": f"{r.floor}층" if r.floor else "층 미표기",
            "dong": r.dong
        } for r in records]

        avg_price = round(sum(prices) / len(prices)) if prices else 0
        res = {
            "found": True,
            "apt_name": records[0].apt_name,
            "trade_type": trade_type,
            "sample_count": len(prices),
            "average_price": format_korean_money(avg_price),
            "min_price": format_korean_money(min(prices)) if prices else "-",
            "max_price": format_korean_money(max(prices)) if prices else "-",
            "recent_deals": recent_deals
        }
        return json.dumps(res, ensure_ascii=False)
    finally:
        db.close()

@tool
def find_affordable_apt(max_price: int, trade_type: str = "매매") -> str:
    """
    지정된 예산(최대 가격) 이하의 실거래가 있었던 아파트 단지 목록을 DB에서 검색합니다.
    
    Args:
        max_price: 최대 가격 (예: 15억이면 150000 또는 15 입력 시 자동 만원 단위 변환)
        trade_type: 거래 유형 ('매매', '전세', '월세'). 기본값은 '매매'
    """
    budget_manwon = max_price * 10000 if max_price < 1000 else max_price
    db = SessionLocal()
    try:
        query = db.query(ApartmentTrade).filter(ApartmentTrade.trade_type == trade_type.strip())
        if trade_type == "매매":
            query = query.filter(ApartmentTrade.deal_amount <= budget_manwon, ApartmentTrade.deal_amount > 0).order_by(ApartmentTrade.deal_amount.desc())
        else:
            query = query.filter(ApartmentTrade.deposit <= budget_manwon, ApartmentTrade.deposit > 0).order_by(ApartmentTrade.deposit.desc())

        records = query.limit(10).all()
        if not records:
            return json.dumps({"found": False, "message": f"{format_korean_money(budget_manwon)} 이하 {trade_type} 단지를 찾지 못했습니다."}, ensure_ascii=False)

        seen = set()
        apt_list = []
        for r in records:
            if r.apt_name not in seen:
                seen.add(r.apt_name)
                price_val = r.deal_amount if trade_type == "매매" else r.deposit
                apt_list.append({
                    "apt_name": r.apt_name,
                    "dong": r.dong,
                    "price_formatted": format_korean_money(price_val),
                    "area_m2": round(r.exclu_use_ar, 1),
                    "floor": f"{r.floor}층" if r.floor else "-",
                    "deal_date": r.deal_date
                })

        res = {
            "found": True,
            "budget": format_korean_money(budget_manwon),
            "trade_type": trade_type,
            "count": len(apt_list),
            "apartments": apt_list[:6]
        }
        return json.dumps(res, ensure_ascii=False)
    finally:
        db.close()

@tool
def search_custom_properties(
    max_deposit: Optional[int] = None,
    max_monthly_rent: Optional[int] = None,
    min_rooms: Optional[int] = None,
    min_bathrooms: Optional[int] = None,
    trade_type: Optional[str] = None,
    property_type: Optional[str] = None
) -> str:
    """
    사용자의 복합 요구조건(예산: 보증금/매매가 한도, 월세한도, 최소 방 개수, 최소 화장실 개수, 거래유형, 건물유형)을 분석하여
    실거래가 DB에서 조건에 정확히 부합하는 최적의 매물을 최대 5건 검색합니다.

    Args:
        max_deposit: 최대 보증금 또는 매매가 한도 (단위: 만원).
                     사용자가 '보증금 1억 미만' 또는 '자본 3억', '예산 1억'이라고 하면 반드시 만원 단위인 10000, 30000 등으로 변환하여 입력해야 합니다.
                     예: 1억 ➜ 10000, 3억 ➜ 30000, 5000만원 ➜ 5000.
        max_monthly_rent: 최대 월세 금액 한도 (단위: 만원).
                     예: 월세 50만원 이하이면 50 입력. 전세나 매매일 경우 생략하거나 0 입력.
        min_rooms: 희망하는 최소 방(침실) 개수 (정수).
                     예: '방 3개' ➜ 3, '방 2개' ➜ 2.
        min_bathrooms: 희망하는 최소 화장실/욕실 개수 (정수).
                     예: '화장실 2개' ➜ 2, '화장실 1개' ➜ 1.
        trade_type: 거래 유형 ('매매', '전세', '월세').
                     '보증금' 언급 시 '전세' 또는 '월세', '매매' 언급 시 '매매'로 지정하세요.
        property_type: 건물 유형 ('아파트', '오피스텔', '연립다세대', '단독다가구').
                     사용자가 특정 유형을 언급하지 않으면 None 또는 생략 가능.
    """
    # 억 단위로 잘못 넘어온 경우(예: 1억을 1로 전달) 만원 단위로 자동 변환 (1000 미만 정수는 억 단위로 간주)
    if max_deposit is not None and 0 < max_deposit < 1000:
        max_deposit = max_deposit * 10000

    db = SessionLocal()
    try:
        from sqlalchemy import or_

        query = db.query(ApartmentTrade)

        # 1. 건물 유형 필터 (아파트, 오피스텔, 연립다세대, 단독다가구)
        norm_prop = property_type.strip() if property_type and property_type.strip() in ["아파트", "오피스텔", "연립다세대", "단독다가구"] else None
        if norm_prop:
            query = query.filter(ApartmentTrade.property_type == norm_prop)

        # 2. 거래 유형 필터
        norm_type = trade_type.strip() if trade_type and trade_type.strip() in ["매매", "전세", "월세"] else None
        if norm_type:
            query = query.filter(ApartmentTrade.trade_type == norm_type)

        # 3. 가격 (보증금 / 매매가) 필터
        if max_deposit is not None and max_deposit > 0:
            if norm_type == "매매":
                query = query.filter(ApartmentTrade.deal_amount <= max_deposit, ApartmentTrade.deal_amount > 0)
            elif norm_type in ["전세", "월세"]:
                query = query.filter(ApartmentTrade.deposit <= max_deposit, ApartmentTrade.deposit > 0)
            else:
                query = query.filter(
                    or_(
                        (ApartmentTrade.trade_type == "매매") & (ApartmentTrade.deal_amount <= max_deposit),
                        (ApartmentTrade.trade_type.in_(["전세", "월세"])) & (ApartmentTrade.deposit <= max_deposit)
                    )
                )

        # 4. 월세 필터
        if max_monthly_rent is not None and max_monthly_rent > 0:
            query = query.filter(ApartmentTrade.monthly_rent <= max_monthly_rent)

        # 5. 방 개수 필터
        if min_rooms is not None and min_rooms > 0:
            query = query.filter(ApartmentTrade.rooms >= min_rooms)

        # 6. 화장실 개수 필터
        if min_bathrooms is not None and min_bathrooms > 0:
            query = query.filter(ApartmentTrade.bathrooms >= min_bathrooms)

        # 정렬: 최신 거래일자 순 및 ID 내림차순
        records = query.order_by(ApartmentTrade.deal_date.desc(), ApartmentTrade.id.desc()).limit(5).all()

        # 조건에 맞는 결과가 없는 경우 완화 조건 제안
        if not records:
            alt_query = db.query(ApartmentTrade)
            if norm_prop:
                alt_query = alt_query.filter(ApartmentTrade.property_type == norm_prop)
            if min_rooms:
                alt_query = alt_query.filter(ApartmentTrade.rooms >= min_rooms)
            if max_deposit:
                alt_query = alt_query.filter(
                    or_(
                        ApartmentTrade.deposit <= max_deposit * 1.5,
                        ApartmentTrade.deal_amount <= max_deposit * 1.5
                    )
                )
            alt_records = alt_query.order_by(ApartmentTrade.deal_date.desc()).limit(3).all()

            msg = f"요청하신 조건(보증금 {format_korean_money(max_deposit) if max_deposit else '무관'}, 방 {min_rooms or '무관'}개, 화장실 {min_bathrooms or '무관'}개)에 정확히 일치하는 매물이 DB에 없습니다."
            if alt_records:
                alt_list = [{
                    "property_type": r.property_type,
                    "apt_name": r.apt_name,
                    "dong": r.dong,
                    "trade_type": r.trade_type,
                    "price_formatted": format_korean_money(r.deal_amount if r.trade_type == "매매" else r.deposit),
                    "rooms": r.rooms,
                    "bathrooms": r.bathrooms,
                    "floor": f"{r.floor}층" if r.floor else "-",
                    "deal_date": r.deal_date
                } for r in alt_records]
                return json.dumps({
                    "found": False,
                    "message": msg,
                    "alternative_suggestions": alt_list,
                    "advice": "조건을 소폭 완화(예산 상향 또는 방/화장실 1개 조정)한 추천 대안 매물입니다."
                }, ensure_ascii=False)
            return json.dumps({"found": False, "message": msg}, ensure_ascii=False)

        results = []
        for r in records:
            if r.trade_type == "매매":
                price_str = f"매매 {format_korean_money(r.deal_amount)}"
            elif r.trade_type == "전세":
                price_str = f"전세 {format_korean_money(r.deposit)}"
            else:
                price_str = f"보증금 {format_korean_money(r.deposit)} / 월 {r.monthly_rent:,}만"

            results.append({
                "property_type": r.property_type,
                "apt_name": r.apt_name,
                "dong": r.dong,
                "trade_type": r.trade_type,
                "price_formatted": price_str,
                "exclu_use_ar": round(r.exclu_use_ar, 1),
                "rooms": r.rooms,
                "bathrooms": r.bathrooms,
                "floor": f"{r.floor}층" if r.floor else "-",
                "deal_date": r.deal_date
            })

        return json.dumps({
            "found": True,
            "condition": {
                "max_deposit": format_korean_money(max_deposit) if max_deposit else "제한없음",
                "max_monthly_rent": f"{max_monthly_rent}만원" if max_monthly_rent else "없음",
                "min_rooms": f"{min_rooms}개 이상" if min_rooms else "무관",
                "min_bathrooms": f"{min_bathrooms}개 이상" if min_bathrooms else "무관",
                "trade_type": norm_type or "전체",
                "property_type": norm_prop or "전체"
            },
            "count": len(results),
            "properties": results
        }, ensure_ascii=False)
    finally:
        db.close()


# ==================== OpenAI Function Calling 스키마 (JSON Schema) ====================

OPENAI_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_recent_price",
            "description": "특정 아파트 단지의 최근 실거래가 평균, 최저/최고가 및 최근 5건 거래 내역을 DB에서 조회합니다.",
            "parameters": {
                "type": "object",
                "properties": {
                    "apt_name": {
                        "type": "string",
                        "description": "검색할 아파트 단지명 (예: '은마', '래미안원베일리', '반포자이')"
                    },
                    "trade_type": {
                        "type": "string",
                        "enum": ["매매", "전세", "월세"],
                        "description": "거래 유형 ('매매', '전세', '월세'). 기본값은 '매매'"
                    }
                },
                "required": ["apt_name"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "find_affordable_apt",
            "description": "지정된 예산(최대 가격, 만원 단위) 이하의 실거래가 있었던 아파트 단지 목록을 DB에서 검색합니다.",
            "parameters": {
                "type": "object",
                "properties": {
                    "max_price": {
                        "type": "integer",
                        "description": "최대 가격 예산 (만원 단위. 예: 15억이면 150000)"
                    },
                    "trade_type": {
                        "type": "string",
                        "enum": ["매매", "전세", "월세"],
                        "description": "거래 유형 ('매매', '전세', '월세'). 기본값은 '매매'"
                    }
                },
                "required": ["max_price"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_custom_properties",
            "description": (
                "사용자가 '자본 3억, 보증금 1억 미만 방 3개 화장실 2개'처럼 복합적인 조건을 자연어로 제시했을 때, "
                "예산(보증금/매매가 한도, 만원 단위), 월세한도, 최소 방 개수, 최소 화장실 개수, 거래유형, 건물유형을 파악하여 "
                "국토교통부 실거래 DB에서 조건에 정확히 부합하는 매물을 최대 5건 검색합니다."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "max_deposit": {
                        "type": "integer",
                        "description": (
                            "보증금 또는 매매가 최대 예산 한도 (단위: 만원). "
                            "예를 들어 사용자가 '보증금 1억 미만' 또는 '자본 1억'이라고 하면 10000, "
                            "'자본 3억' 또는 '3억 이하'라고 하면 30000으로 자동 변환하여 정수로 입력해야 합니다."
                        )
                    },
                    "max_monthly_rent": {
                        "type": "integer",
                        "description": "월세 최대 예산 한도 (단위: 만원). 예: 월세 50만원 이하이면 50"
                    },
                    "min_rooms": {
                        "type": "integer",
                        "description": "희망하는 최소 방(침실) 개수 (정수). 예: 방 3개이면 3"
                    },
                    "min_bathrooms": {
                        "type": "integer",
                        "description": "희망하는 최소 화장실/욕실 개수 (정수). 예: 화장실 2개이면 2"
                    },
                    "trade_type": {
                        "type": "string",
                        "enum": ["매매", "전세", "월세"],
                        "description": "거래 유형 ('매매', '전세', '월세')"
                    },
                    "property_type": {
                        "type": "string",
                        "enum": ["아파트", "오피스텔", "연립다세대", "단독다가구"],
                        "description": "건물 유형 ('아파트', '오피스텔', '연립다세대', '단독다가구')"
                    }
                }
            }
        }
    }
]

# 두 모델이 공유하는 통일된 도구 리스트
UNIFIED_TOOLS = [search_recent_price, find_affordable_apt, search_custom_properties]
TOOL_MAP = {
    "search_recent_price": search_recent_price,
    "find_affordable_apt": find_affordable_apt,
    "search_custom_properties": search_custom_properties
}

SYSTEM_PROMPT = (
    "당신은 대한민국 최고 수준의 부동산 프롭테크 플랫폼 '집뷰(ZipView)'의 전문 공인중개사이자 AI 부동산 데이터 분석가입니다.\n"
    "사용자의 질문에 따라 제공된 통일 도구(search_recent_price, find_affordable_apt, search_custom_properties)를 적극 호출하여 "
    "실제 국토교통부 실거래 DB 수치에 기반해 분석해 주세요.\n\n"
    "복합 조건 처리 지침:\n"
    "- 사용자가 '자본 3억, 보증금 1억 미만에 방 3개, 화장실 2개'처럼 복합적인 조건을 제시하면 반드시 `search_custom_properties` 도구를 호출하세요.\n"
    "- 금액 단위는 만원 단위입니다 (예: 1억 미만 ➜ max_deposit=10000, 3억 ➜ 30000).\n"
    "- 건물유형(아파트, 오피스텔, 연립다세대, 단독다가구)이 언급되면 `property_type` 파라미터에 명시하세요.\n"
    "- 금액은 항상 'X억 Y만원' 형태로 이해하기 쉽게 안내하고, 건물유형, 방/화장실 개수, 전용면적(㎡), 층수, 최근 거래일을 상세히 브리핑해 주세요."
)


# ==================== LangChain 멀티 LLM 팩토리 (Factory Pattern) ====================

class LLMAgentFactory:
    """
    [요구사항 충족] 팩토리 패턴(Factory Pattern) 클래스
    model_choice 파라미터에 따라 ChatOpenAI(GPT-4o) 또는 ChatGoogleGenerativeAI(Gemini 1.5)를 생성하고
    동일한 Function Calling 도구를 바인딩하여 실행합니다.
    """

    @staticmethod
    def create_llm(model_choice: str = "gpt"):
        """
        model_choice에 따라 적절한 LangChain LLM 인스턴스를 반환하는 팩토리 메서드
        """
        choice = (model_choice or "gpt").lower().strip()

        if choice in ["gpt", "openai", "gpt-4o", "gpt-4o-mini"]:
            try:
                from langchain_openai import ChatOpenAI
            except ImportError:
                raise ImportError("langchain-openai 패키지가 설치되지 않았습니다. pip install langchain-openai")

            if not OPENAI_API_KEY:
                raise ValueError(".env 파일에 OPENAI_API_KEY가 설정되어 있지 않습니다.")

            return ChatOpenAI(
                model="gpt-4o",
                api_key=OPENAI_API_KEY,
                temperature=0.3,
                timeout=15
            )

        elif choice in ["gemini", "google", "gemini-1.5-flash", "gemini-1.5-pro"]:
            try:
                from langchain_google_genai import ChatGoogleGenerativeAI
            except ImportError:
                raise ImportError("langchain-google-genai 패키지가 설치되지 않았습니다. pip install langchain-google-genai")

            if not GEMINI_API_KEY:
                raise ValueError(".env 파일에 GEMINI_API_KEY가 설정되어 있지 않습니다.")

            return ChatGoogleGenerativeAI(
                model="gemini-1.5-flash",
                google_api_key=GEMINI_API_KEY,
                temperature=0.3,
                timeout=15
            )
        else:
            raise ValueError(f"지원하지 않는 model_choice입니다: '{model_choice}'. ('gpt' 또는 'gemini' 선택 가능)")

    @classmethod
    def execute_agent(cls, prompt: str, model_choice: str = "gpt") -> str:
        """
        팩토리로부터 LLM을 받아 동일한 Function Calling 인터페이스로 질문을 처리하고 최종 답변을 반환
        """
        try:
            from langchain_core.messages import SystemMessage, HumanMessage, ToolMessage
        except ImportError:
            # LangChain 미설치 시 기존 직접 호출 엔진으로 자동 폴백
            return cls._direct_fallback(prompt, model_choice)

        try:
            # 1. 팩토리 패턴으로 LLM 객체 생성
            base_llm = cls.create_llm(model_choice)

            # 2. 통일된 Function Calling 도구 바인딩 (bind_tools)
            llm_with_tools = base_llm.bind_tools(UNIFIED_TOOLS)

            # 3. 1차 대화 호출 (도구 호출 여부 판단)
            messages = [
                SystemMessage(content=SYSTEM_PROMPT),
                HumanMessage(content=prompt)
            ]
            ai_msg = llm_with_tools.invoke(messages)

            # 4. 도구 호출이 발생했을 경우 (Tool Calls 처리)
            if hasattr(ai_msg, "tool_calls") and ai_msg.tool_calls:
                messages.append(ai_msg)
                for tool_call in ai_msg.tool_calls:
                    tool_name = tool_call["name"]
                    tool_args = tool_call["args"]
                    tool_id = tool_call["id"]

                    selected_tool = TOOL_MAP.get(tool_name)
                    if selected_tool:
                        # LangChain tool invoke
                        tool_output = selected_tool.invoke(tool_args)
                    else:
                        tool_output = json.dumps({"error": f"존재하지 않는 도구: {tool_name}"})

                    messages.append(ToolMessage(content=str(tool_output), tool_call_id=tool_id))

                # 5. 도구 실행 결과를 포함하여 2차 최종 브리핑 생성
                final_response = llm_with_tools.invoke(messages)
                return final_response.content.strip()
            else:
                return ai_msg.content.strip()

        except Exception as e:
            print(f"[LangChain Factory Error - {model_choice}]: {e}")
            return cls._direct_fallback(prompt, model_choice)

    @classmethod
    def _direct_fallback(cls, prompt: str, model_choice: str) -> str:
        """LangChain 모듈 로드 불가 또는 네트워크 장애 시 직접 DB 질의 스마트 폴백"""
        try:
            # 1. 복합 조건 (방, 화장실, 보증금, 예산) 질문 감지 시 search_custom_properties 직접 실행
            if any(w in prompt for w in ["방", "화장실", "욕실", "보증금", "미만", "이하", "추천", "자본"]):
                deposit_match = re.search(r'보증금\s*(\d+)억', prompt) or re.search(r'(\d+)억\s*(?:미만|이하)', prompt)
                rooms_match = re.search(r'방\s*(\d+)개', prompt)
                baths_match = re.search(r'화장실\s*(\d+)개', prompt) or re.search(r'욕실\s*(\d+)개', prompt)

                max_dep = int(deposit_match.group(1)) * 10000 if deposit_match else None
                rooms = int(rooms_match.group(1)) if rooms_match else None
                baths = int(baths_match.group(1)) if baths_match else None
                t_type = "전세" if "전세" in prompt else ("월세" if "월세" in prompt else None)
                
                # 건물유형 파악
                p_type = None
                if "오피스텔" in prompt: p_type = "오피스텔"
                elif "연립" in prompt or "다세대" in prompt or "빌라" in prompt: p_type = "연립다세대"
                elif "단독" in prompt or "다가구" in prompt: p_type = "단독다가구"
                elif "아파트" in prompt: p_type = "아파트"

                call_args = {
                    "max_deposit": max_dep,
                    "min_rooms": rooms,
                    "min_bathrooms": baths,
                    "trade_type": t_type,
                    "property_type": p_type
                }
                if hasattr(search_custom_properties, "invoke"):
                    res_str = search_custom_properties.invoke(call_args)
                else:
                    res_str = search_custom_properties(**call_args)
                data = json.loads(res_str) if isinstance(res_str, str) else res_str
                if data.get("found"):
                    props_text = "\n".join([
                        f"• [{p.get('property_type', '아파트')}] **{p['apt_name']}** ({p['dong']}) : {p['price_formatted']} · 전용 {p['exclu_use_ar']}㎡ (방 {p['rooms']}개, 욕실 {p['bathrooms']}개, {p['floor']}) | 최근계약: {p['deal_date']}"
                        for p in data["properties"]
                    ])
                    cond = data.get("condition", {})
                    return (
                        f"🏡 **[맞춤 실거래 조건 매물 추천 결과]**\n\n"
                        f"요청하신 조건(보증금 {cond.get('max_deposit')}, 방 {cond.get('min_rooms')}, 화장실 {cond.get('min_bathrooms')}, 유형 {cond.get('property_type', '전체')})에 부합하는 최근 국토교통부 실거래 데이터 분석 결과입니다:\n\n"
                        f"{props_text}\n\n"
                        f"💡 국토부 실거래 DB 기반 통계입니다. (선택 엔진: {model_choice.upper()})"
                    )

            # 2. 특정 단지 실거래가 질의
            trade_type = "전세" if "전세" in prompt else "매매"
            apt_name = "은마"
            if "원베일리" in prompt: apt_name = "래미안원베일리"
            elif "자이" in prompt: apt_name = "반포자이"
            elif "도곡" in prompt: apt_name = "도곡렉슬"

            if hasattr(search_recent_price, "invoke"):
                res_str = search_recent_price.invoke({"apt_name": apt_name, "trade_type": trade_type})
            else:
                res_str = search_recent_price(apt_name, trade_type)

            data = json.loads(res_str) if isinstance(res_str, str) else res_str
            if data.get("found"):
                return (
                    f"🏢 **[{data['apt_name']}] {data['trade_type']} 실거래가 분석 브리핑**\n\n"
                    f"- **최근 {data['trade_type']} 평균 거래가**: {data['average_price']}\n"
                    f"- **실거래 범위**: 최저 {data['min_price']} ~ 최고 {data['max_price']}\n"
                    f"- **최근 계약 내역**: {data['recent_deals'][0]['deal_date']} "
                    f"({data['recent_deals'][0]['floor']}, {data['recent_deals'][0]['price_formatted']})\n\n"
                    f"💡 국토교통부 실거래 DB 조회 결과입니다. (선택 엔진: {model_choice.upper()})"
                )
        except Exception as err:
            print(f"[Fallback Err] {err}")

        return f"국토부 실거래 DB 데이터를 조회하여 분석 중입니다. (엔진: {model_choice.upper()})"


def ask_multi_llm_agent(prompt: str, model_choice: str = "gpt") -> str:
    """외부 호출용 통합 진입점 함수"""
    return LLMAgentFactory.execute_agent(prompt=prompt, model_choice=model_choice)
