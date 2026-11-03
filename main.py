import os
import sys
import asyncio
from datetime import datetime

# Windows 콘솔 cp949 인코딩 에러 방지
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
from typing import Optional, List
from collections import defaultdict
from fastapi import FastAPI, Depends, Query, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from database import engine, get_db, SessionLocal, Base
from models import ApartmentTrade
from ai_agent import ask_multi_llm_agent, LLMAgentFactory
from fetch_api import (
    fetch_and_save_apt_trades,
    fetch_and_save_apt_rents,
    fetch_and_save_offi_trades,
    fetch_and_save_offi_rents,
    fetch_and_save_rh_trades,
    fetch_and_save_rh_rents,
    fetch_and_save_sh_trades,
    fetch_and_save_sh_rents,
    run_integrated_etl
)

# DB 테이블 생성 (테이블이 없을 경우 자동 생성)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="ZipView 국토교통부 실거래가 API 서버",
    description="국토부 4대 주택유형 실거래가 데이터를 실시간으로 동기화 및 조회하고 프론트엔드 대시보드에 제공하는 FastAPI 서버",
    version="1.1.0"
)

# 1. CORS 미들웨어 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
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


# ==================== 실시간 동기화 상태 관리 ====================
SYNC_STATUS = {
    "last_synced_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    "last_sync_region": "11680 (강남구)",
    "last_added_count": 0,
    "is_syncing": False,
    "monitored_regions": ["11680", "11650", "11710"] # 강남구, 서초구, 송파구
}


def execute_sync_for_region(regional_code: str, deal_ymd: Optional[str] = None) -> dict:
    """국토교통부 4대 주택유형 8종 API를 실시간 호출하여 DB에 최신 거래를 Upsert 동기화"""
    target_ymd = deal_ymd or "202410"
    db = SessionLocal()
    total_added = 0
    try:
        SYNC_STATUS["is_syncing"] = True
        
        # 1. 아파트 (매매 / 전월세)
        try: total_added += fetch_and_save_apt_trades(regional_code, target_ymd, db)
        except Exception as e: print(f"[Sync] 아파트 매매 스킵: {e}")
        try: total_added += fetch_and_save_apt_rents(regional_code, target_ymd, db)
        except Exception as e: print(f"[Sync] 아파트 전월세 스킵: {e}")

        # 2. 오피스텔 (매매 / 전월세)
        try: total_added += fetch_and_save_offi_trades(regional_code, target_ymd, db)
        except Exception as e: print(f"[Sync] 오피스텔 매매 스킵: {e}")
        try: total_added += fetch_and_save_offi_rents(regional_code, target_ymd, db)
        except Exception as e: print(f"[Sync] 오피스텔 전월세 스킵: {e}")

        # 3. 연립다세대 빌라 (매매 / 전월세)
        try: total_added += fetch_and_save_rh_trades(regional_code, target_ymd, db)
        except Exception as e: print(f"[Sync] 연립다세대 매매 스킵: {e}")
        try: total_added += fetch_and_save_rh_rents(regional_code, target_ymd, db)
        except Exception as e: print(f"[Sync] 연립다세대 전월세 스킵: {e}")

        # 4. 단독/다가구 원룸 (매매 / 전월세)
        try: total_added += fetch_and_save_sh_trades(regional_code, target_ymd, db)
        except Exception as e: print(f"[Sync] 단독다가구 매매 스킵: {e}")
        try: total_added += fetch_and_save_sh_rents(regional_code, target_ymd, db)
        except Exception as e: print(f"[Sync] 단독다가구 전월세 스킵: {e}")

        SYNC_STATUS["last_synced_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        SYNC_STATUS["last_sync_region"] = regional_code
        SYNC_STATUS["last_added_count"] = total_added

        total_db_count = db.query(ApartmentTrade).count()
        return {
            "status": "success",
            "regional_code": regional_code,
            "deal_ymd": target_ymd,
            "added_count": total_added,
            "total_records": total_db_count,
            "synced_at": SYNC_STATUS["last_synced_at"]
        }
    finally:
        SYNC_STATUS["is_syncing"] = False
        db.close()


# 백그라운드 1시간 주기 자동 수집 워커
async def periodic_auto_sync_worker():
    """서버 가동 중 주기적으로(1시간마다) 주요 지역의 국토부 최신 데이터를 자동 갱신"""
    while True:
        try:
            await asyncio.sleep(3600) # 1시간마다
            print("[Auto-Sync Worker] 국토교통부 최신 실거래 데이터 정기 동기화 시작...")
            for reg in SYNC_STATUS["monitored_regions"]:
                res = execute_sync_for_region(reg, "202410")
                print(f"  * 지역({reg}) 동기화 완료: 신규 {res['added_count']}건 반영")
        except asyncio.CancelledError:
            break
        except Exception as err:
            print(f"[Auto-Sync Worker Error]: {err}")
            await asyncio.sleep(60)


@app.on_event("startup")
async def on_startup():
    """서버 시작 시 백그라운드 실시간 동기화 워커 가동"""
    asyncio.create_task(periodic_auto_sync_worker())
    print("[FastAPI] ZipView 실시간 국토부 동기화 엔진 가동 완료")


@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "ZipView Real Estate Realtime Trade API",
        "docs": "/docs",
        "sync_status": SYNC_STATUS
    }


# ==================== 1. 실시간 국토부 동기화 엔드포인트 ====================

@app.post("/api/sync/{regional_code}")
@app.get("/api/sync/{regional_code}")
def sync_realtime_data(
    regional_code: str,
    deal_ymd: Optional[str] = Query("202410", description="계약년월 (YYYYMM)"),
    background_tasks: BackgroundTasks = None
):
    """
    [실시간 동기화 엔드포인트]
    프론트엔드에서 '실시간 동기화' 버튼을 누르면 국토교통부 API를 즉시 호출하여
    신규 계약건을 DB에 실시간 반영하고 결과 요약을 반환합니다.
    """
    result = execute_sync_for_region(regional_code, deal_ymd)
    return result


@app.get("/api/sync-status")
def get_sync_status(db: Session = Depends(get_db)):
    """현재 실시간 동기화 상태 및 누적 건수 확인"""
    total_count = db.query(ApartmentTrade).count()
    apt_count = db.query(ApartmentTrade).filter(ApartmentTrade.property_type == "아파트").count()
    offi_count = db.query(ApartmentTrade).filter(ApartmentTrade.property_type == "오피스텔").count()
    rh_count = db.query(ApartmentTrade).filter(ApartmentTrade.property_type == "연립다세대").count()
    sh_count = db.query(ApartmentTrade).filter(ApartmentTrade.property_type == "단독다가구").count()

    return {
        "status": "online",
        "realtime_sync_active": True,
        "sync_info": SYNC_STATUS,
        "database_stats": {
            "total_records": total_count,
            "apartment_records": apt_count,
            "officetel_records": offi_count,
            "villa_records": rh_count,
            "detached_records": sh_count
        }
    }


# ==================== 2. 실거래가 조회 엔드포인트 (On-Demand 자동 동기화 내장) ====================

@app.get("/api/trades/{regional_code}")
def get_trades(
    regional_code: str,
    apt_name: Optional[str] = Query(None, description="단지명 (예: 은마, 래미안, 자이)"),
    property_type: Optional[str] = Query(None, description="건물유형 ('아파트', '오피스텔', '연립다세대', '단독다가구')"),
    trade_type: Optional[str] = Query(None, description="거래유형 ('매매', '전세', '월세')"),
    auto_sync: bool = Query(True, description="데이터가 없을 경우 국토부 API 자동 즉시 수집 여부"),
    limit: int = Query(100, ge=1, le=500, description="최대 반환 레코드 수"),
    db: Session = Depends(get_db)
):
    """
    [On-Demand 자동 실시간 동기화 지원]
    조회 시 해당 지역 데이터가 DB에 비어있으면 백엔드가 국토부 API를 실시간 호출하여
    즉시 DB에 적재한 후 최신 거래 목록과 차트를 리턴합니다.
    """
    # 1. DB 존재 여부 확인 및 On-Demand 자동 동기화
    existing_count = db.query(ApartmentTrade).filter(ApartmentTrade.regional_code == regional_code).count()
    if existing_count == 0 and auto_sync:
        print(f"⚡ [On-Demand 실시간 동기화] 지역({regional_code}) 데이터 없음 ➜ 국토부 API 즉시 호출")
        execute_sync_for_region(regional_code, "202410")

    query = db.query(ApartmentTrade).filter(ApartmentTrade.regional_code == regional_code)

    if property_type and property_type.strip():
        query = query.filter(ApartmentTrade.property_type == property_type.strip())

    if apt_name and apt_name.strip():
        search_term = f"%{apt_name.strip()}%"
        query = query.filter(ApartmentTrade.apt_name.ilike(search_term))

    if trade_type and trade_type.strip():
        query = query.filter(ApartmentTrade.trade_type == trade_type.strip())

    # 2. 최근 거래 내역 100건 (계약일자 내림차순, 최신순)
    trades_records = query.order_by(
        desc(ApartmentTrade.deal_date),
        desc(ApartmentTrade.id)
    ).limit(limit).all()

    # 3. 거래 목록 응답 가공
    trade_list = []
    latest_trade_price = None
    latest_jeonse_price = None

    for item in trades_records:
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

    # 4. 프론트엔드 차트 렌더링용 월별 평균가 집계 (오름차순)
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
            "tradeAvgPrice": avg_trade,
            "jeonseAvgPrice": avg_jeonse,
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
        "trades": trade_list,
        "last_synced_at": SYNC_STATUS["last_synced_at"]
    }


# ==================== 3. AI 부동산 상담 챗봇 엔드포인트 ====================

class ChatRequest(BaseModel):
    prompt: str
    model_choice: Optional[str] = "gpt"

@app.post("/api/chat")
def chat_with_multi_llm(req: ChatRequest):
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
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
