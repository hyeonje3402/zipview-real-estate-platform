import os
from typing import Optional, List
from collections import defaultdict
from fastapi import FastAPI, Depends, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from database import engine, get_db, Base
from models import ApartmentTrade
from ai_agent import ask_multi_llm_agent, LLMAgentFactory

# DB 테이블 생성 (테이블이 없을 경우 자동 생성)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="ZipView 국토교통부 실거래가 API 서버",
    description="국토부 아파트 매매/전월세 실거래가 데이터를 조회하고 프론트엔드 차트 및 테이블에 제공하는 FastAPI 서버",
    version="1.0.0"
)

# 1. CORS 미들웨어 설정 (프론트엔드 React/HTML 개발 서버와의 연동 허용)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173", # Vite React 기본 포트
        "http://127.0.0.1:5173",
        "*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def format_korean_money(amount_manwon: Optional[int]) -> str:
    """만원 단위 정수를 한국어 'X억 Y만원' 포맷으로 변환"""
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

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "ZipView Real Estate Trade API",
        "docs": "/docs"
    }

# 2. 특정 지역코드 및 단지명의 실거래 데이터 조회 엔드포인트
@app.get("/api/trades/{regional_code}")
def get_trades(
    regional_code: str,
    apt_name: Optional[str] = Query(None, description="단지명 (예: 은마, 래미안, 자이)"),
    property_type: Optional[str] = Query(None, description="건물유형 ('아파트', '오피스텔', '연립다세대', '단독다가구')"),
    trade_type: Optional[str] = Query(None, description="거래유형 ('매매', '전세', '월세')"),
    limit: int = Query(100, ge=1, le=500, description="최대 반환 레코드 수"),
    db: Session = Depends(get_db)
):
    """
    [요구사항 충족]
    특정 지역코드(regional_code)와 건물유형(property_type), 단지명(apt_name)을 필터링하여
    계약일(deal_date) 내림차순으로 최근 거래 내역 100건 및 월별 차트 데이터를 반환합니다.
    """
    query = db.query(ApartmentTrade).filter(ApartmentTrade.regional_code == regional_code)

    if property_type and property_type.strip():
        query = query.filter(ApartmentTrade.property_type == property_type.strip())

    if apt_name and apt_name.strip():
        search_term = f"%{apt_name.strip()}%"
        query = query.filter(ApartmentTrade.apt_name.ilike(search_term))

    if trade_type and trade_type.strip():
        query = query.filter(ApartmentTrade.trade_type == trade_type.strip())

    # 1. 최근 거래 내역 100건 (계약일자 내림차순, 최신순)
    trades_records = query.order_by(
        desc(ApartmentTrade.deal_date),
        desc(ApartmentTrade.id)
    ).limit(limit).all()

    # 2. 거래 목록 응답 가공
    trade_list = []
    latest_trade_price = None
    latest_jeonse_price = None

    for item in trades_records:
        # 가격 표기 생성
        if item.trade_type == "매매":
            price_label = format_korean_money(item.deal_amount)
            raw_price = item.deal_amount
            if latest_trade_price is None and item.deal_amount:
                latest_trade_price = item.deal_amount
        else:
            if item.monthly_rent and item.monthly_rent > 0:
                price_label = f"{format_korean_money(item.deposit)} / 월 {item.monthly_rent:,}만"
                raw_price = item.deposit
            else:
                price_label = format_korean_money(item.deposit)
                raw_price = item.deposit
                if latest_jeonse_price is None and item.deposit:
                    latest_jeonse_price = item.deposit

        trade_list.append({
            "id": item.id,
            "property_type": item.property_type,
            "trade_type": item.trade_type,
            "apt_name": item.apt_name,
            "dong": item.dong,
            "jibun": item.jibun,
            "exclu_use_ar": item.exclu_use_ar,
            "rooms": item.rooms,
            "bathrooms": item.bathrooms,
            "deal_amount": item.deal_amount,
            "deposit": item.deposit,
            "monthly_rent": item.monthly_rent,
            "raw_price": raw_price,
            "price_formatted": price_label,
            "deal_date": item.deal_date,
            "deal_year": item.deal_year,
            "deal_month": item.deal_month,
            "deal_day": item.deal_day,
            "floor": item.floor,
            "build_year": item.build_year,
            "cancel_deal_day": item.cancel_deal_day,
            "req_gbn": item.req_gbn
        })

    # 3. 프론트엔드 Recharts 렌더링용 월별 평균가 집계 (오름차순)
    monthly_data = defaultdict(lambda: {
        "trade_sum": 0, "trade_cnt": 0,
        "jeonse_sum": 0, "jeonse_cnt": 0
    })

    for item in trades_records:
        ym = f"{item.deal_year:04d}-{item.deal_month:02d}"
        if item.trade_type == "매매" and item.deal_amount:
            monthly_data[ym]["trade_sum"] += item.deal_amount
            monthly_data[ym]["trade_cnt"] += 1
        elif item.trade_type == "전세" and item.deposit:
            monthly_data[ym]["jeonse_sum"] += item.deposit
            monthly_data[ym]["jeonse_cnt"] += 1

    chart_data = []
    for ym in sorted(monthly_data.keys()):
        d = monthly_data[ym]
        avg_trade = round(d["trade_sum"] / d["trade_cnt"]) if d["trade_cnt"] > 0 else None
        avg_jeonse = round(d["jeonse_sum"] / d["jeonse_cnt"]) if d["jeonse_cnt"] > 0 else None
        chart_data.append({
            "yearMonth": ym,
            "tradeAvgPrice": avg_trade,           # 만원 단위 (예: 315000 = 31.5억)
            "jeonseAvgPrice": avg_jeonse,         # 만원 단위 (예: 160000 = 16억)
            "tradeCount": d["trade_cnt"],
            "jeonseCount": d["jeonse_cnt"],
            "tradePriceLabel": format_korean_money(avg_trade) if avg_trade else "-",
            "jeonsePriceLabel": format_korean_money(avg_jeonse) if avg_jeonse else "-"
        })

    return {
        "status": "success",
        "regional_code": regional_code,
        "apt_name": apt_name or "전체 단지",
        "total_count": len(trade_list),
        "summary": {
            "latest_trade_price": format_korean_money(latest_trade_price) if latest_trade_price else "-",
            "latest_jeonse_price": format_korean_money(latest_jeonse_price) if latest_jeonse_price else "-",
            "sample_count": len(trade_list)
        },
        "chart_data": chart_data,
        "trades": trade_list
    }

class ChatRequest(BaseModel):
    prompt: str
    model_choice: Optional[str] = "gpt" # "gpt" (OpenAI GPT-4o) 또는 "gemini" (Google Gemini 1.5)

# 3. LangChain 팩토리 기반 Multi-LLM 자연어 부동산 데이터 분석 챗봇 엔드포인트
@app.post("/api/chat")
def chat_with_multi_llm(req: ChatRequest):
    """
    [Multi-LLM LangChain 팩토리 연동]
    model_choice 파라미터('gpt' 또는 'gemini')에 따라 LangChain Chat 객체를 팩토리 패턴으로 생성하여
    동일한 Function Calling 도구(search_recent_price, find_affordable_apt)로 국토부 실거래 DB를 분석합니다.
    """
    if not req.prompt or not req.prompt.strip():
        raise HTTPException(status_code=400, detail="질문 내용을 입력해 주세요.")
    
    choice = req.model_choice or "gpt"
    answer = ask_multi_llm_agent(prompt=req.prompt.strip(), model_choice=choice)
    
    return {
        "status": "success",
        "model_choice": choice,
        "prompt": req.prompt,
        "reply": answer
    }

if __name__ == "__main__":
    import uvicorn
    # 직접 python main.py 로도 8000번 포트 실행 가능
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

