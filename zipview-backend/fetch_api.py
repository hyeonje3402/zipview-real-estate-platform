import os
import re
import sys
import asyncio
from datetime import datetime
from urllib.parse import unquote, urlencode
from typing import Optional, List, Dict, Any, Set, Tuple
from dotenv import load_dotenv

# Windows 콘솔 cp949 인코딩 에러 방지
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

import aiohttp
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

# xmltodict 임포트 (미설치 시 내장 xml.etree 폴백)
try:
    import xmltodict
except ImportError:
    xmltodict = None

from database import engine, SessionLocal, Base
from models import ApartmentTrade, infer_rooms_and_bathrooms

load_dotenv()

# 국토교통부 일반 인증키
MOLIT_API_KEY = os.getenv("MOLIT_API_KEY", "0b448718755cbe9eee0ccf3b56b4efdae27a12d22db359e927a7e8aa58ea9334")

# ==================== 국토교통부 4대 주택유형 8종 Open API 엔드포인트 ====================
# 1. 아파트
ENDPOINT_APT_TRADE = os.getenv("MOLIT_ENDPOINT_TRADE", "https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade")
ENDPOINT_APT_RENT  = os.getenv("MOLIT_ENDPOINT_RENT",  "https://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent")

# 2. 오피스텔
ENDPOINT_OFFI_TRADE = os.getenv("MOLIT_ENDPOINT_OFFI_TRADE", "https://apis.data.go.kr/1613000/RTMSDataSvcOffiTrade/getRTMSDataSvcOffiTrade")
ENDPOINT_OFFI_RENT  = os.getenv("MOLIT_ENDPOINT_OFFI_RENT",  "https://apis.data.go.kr/1613000/RTMSDataSvcOffiRent/getRTMSDataSvcOffiRent")

# 3. 연립다세대 (빌라)
ENDPOINT_RH_TRADE = os.getenv("MOLIT_ENDPOINT_RH_TRADE", "https://apis.data.go.kr/1613000/RTMSDataSvcRHTrade2/getRTMSDataSvcRHTrade2")
ENDPOINT_RH_RENT  = os.getenv("MOLIT_ENDPOINT_RH_RENT",  "https://apis.data.go.kr/1613000/RTMSDataSvcRHRent/getRTMSDataSvcRHRent")

# 4. 단독/다가구 (원룸·투룸·단독주택)
ENDPOINT_SH_TRADE = os.getenv("MOLIT_ENDPOINT_SH_TRADE", "https://apis.data.go.kr/1613000/RTMSDataSvcSHTrade/getRTMSDataSvcSHTrade")
ENDPOINT_SH_RENT  = os.getenv("MOLIT_ENDPOINT_SH_RENT",  "https://apis.data.go.kr/1613000/RTMSDataSvcSHRent/getRTMSDataSvcSHRent")

CHUNK_SIZE = 200  # 대규모 배치 인서트 청크 크기


def clean_int(val: Any) -> Optional[int]:
    """' 315,000 ' 형태의 쉼표/공백 포함 문자열을 안전하게 정수로 변환"""
    if val is None:
        return None
    val_str = str(val).replace(",", "").strip()
    if not val_str:
        return None
    try:
        return int(float(val_str))
    except ValueError:
        return None


def clean_float(val: Any) -> float:
    """면적 등 소수점이 있는 값을 float로 안전하게 변환"""
    if val is None:
        return 0.0
    val_str = str(val).replace(",", "").strip()
    try:
        return float(val_str)
    except ValueError:
        return 0.0


# ==================== 비동기 HTTP 요청 & 재시도 (aiohttp + Retry) ====================

async def request_molit_xml_async(
    session: aiohttp.ClientSession,
    endpoint: str,
    lawd_cd: str,
    deal_ymd: str,
    max_retries: int = 2,
    base_delay: float = 0.4
) -> str:
    """
    aiohttp를 사용한 국토교통부 Open API 고성능 비동기 호출 함수
    Rate Limit 방어 및 네트워크 불안정 극복을 위한 지수 백오프(Exponential Backoff) 재시도 포함
    """
    raw_key = unquote(MOLIT_API_KEY)
    params = {
        "serviceKey": raw_key,
        "LAWD_CD": lawd_cd,
        "DEAL_YMD": deal_ymd,
        "numOfRows": 1000,
        "pageNo": 1
    }
    url = f"{endpoint}?{urlencode(params)}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ZipViewRealEstateETL/3.0"
    }

    for attempt in range(1, max_retries + 1):
        try:
            timeout = aiohttp.ClientTimeout(total=15)
            async with session.get(url, headers=headers, timeout=timeout) as response:
                if response.status == 200:
                    text = await response.text(encoding="utf-8", errors="replace")
                    return text
                elif response.status == 429:  # Too Many Requests (Rate limit)
                    wait_time = base_delay * (2 ** attempt)
                    print(f"⚠️ [Rate Limit] 429 감지 - {wait_time:.1f}초 대기 후 재시도 ({attempt}/{max_retries})")
                    await asyncio.sleep(wait_time)
                elif response.status == 403:
                    print(f"🔒 [403 Forbidden] 권한 미신청 엔드포인트: {endpoint}")
                    return ""
                else:
                    print(f"⚠️ [HTTP {response.status}] API 응답 이상: 재시도 ({attempt}/{max_retries})")
                    await asyncio.sleep(base_delay * attempt)
        except (aiohttp.ClientError, asyncio.TimeoutError) as err:
            if attempt == max_retries:
                print(f"❌ [API 호출 실패] 최종 타임아웃/네트워크 오류: {err}")
                return ""
            await asyncio.sleep(base_delay * attempt)

    return ""


def parse_xml_to_items(xml_str: str) -> List[Dict[str, Any]]:
    """XML 응답을 파싱하여 items 목록(dict 리스트) 반환"""
    if not xml_str or not xml_str.strip():
        return []
    if xmltodict:
        try:
            data = xmltodict.parse(xml_str)
            items_obj = data.get("response", {}).get("body", {}).get("items", {})
            if not items_obj:
                return []
            item = items_obj.get("item", [])
            return [item] if isinstance(item, dict) else (item if isinstance(item, list) else [])
        except Exception:
            return []
    else:
        import xml.etree.ElementTree as ET
        try:
            root = ET.fromstring(xml_str)
            items = []
            for item_el in root.findall(".//item"):
                row = {child.tag: child.text for child in item_el}
                items.append(row)
            return items
        except Exception:
            return []


def extract_base_fields(it: Dict[str, Any], lawd_cd: str, deal_ymd: str) -> Dict[str, Any]:
    """공통 일자, 층수, 동, 지번 등을 추출"""
    year = clean_int(it.get("년") or it.get("dealYear")) or int(deal_ymd[:4])
    month = clean_int(it.get("월") or it.get("dealMonth")) or int(deal_ymd[4:6])
    day = clean_int(it.get("일") or it.get("dealDay")) or 1
    deal_date = f"{year:04d}-{month:02d}-{day:02d}"
    floor = clean_int(it.get("층") or it.get("floor"))
    dong = (it.get("법정동") or it.get("umdNm") or "").strip()
    jibun = (it.get("지번") or it.get("jibun") or "").strip()
    build_year = clean_int(it.get("건축년도") or it.get("buildYear"))
    cancel_deal_day = (it.get("cdealDay") or it.get("해제사유발생일") or it.get("cancelDealDay") or "").strip()
    req_gbn = (it.get("dealingGbn") or it.get("거래유형") or it.get("reqGbn") or "").strip()

    return {
        "deal_year": year,
        "deal_month": month,
        "deal_day": day,
        "deal_date": deal_date,
        "floor": floor,
        "dong": dong,
        "jibun": jibun,
        "build_year": build_year,
        "cancel_deal_day": cancel_deal_day or None,
        "req_gbn": req_gbn or None
    }


# ==================== 고속 청크 비동기 Batch Upsert 헬퍼 ====================

async def batch_upsert_trades(
    db: AsyncSession,
    property_type: str,
    trade_type: str,
    lawd_cd: str,
    candidates: List[ApartmentTrade]
) -> int:
    """
    기존 레코드와의 중복 키를 메모리 상에서 고속 O(1) 조회한 뒤,
    신규 레코드만 CHUNK_SIZE 단위로 나누어 비동기 Batch Insert 실행
    """
    if not candidates:
        return 0

    # 1. 해당 지역 및 거래유형의 기존 키 목록을 한 번의 쿼리로 일괄 조회
    stmt = select(
        ApartmentTrade.apt_name,
        ApartmentTrade.deal_date,
        ApartmentTrade.floor,
        ApartmentTrade.deal_amount,
        ApartmentTrade.deposit,
        ApartmentTrade.monthly_rent
    ).where(
        ApartmentTrade.property_type == property_type,
        ApartmentTrade.trade_type == trade_type,
        ApartmentTrade.regional_code == lawd_cd
    )
    result = await db.execute(stmt)
    existing_keys: Set[Tuple] = {
        (r[0], r[1], r[2], r[3], r[4], r[5])
        for r in result.all()
    }

    # 2. 신규 레코드 필터링
    new_records = []
    seen_in_batch = set()
    for item in candidates:
        key = (
            item.apt_name,
            item.deal_date,
            item.floor,
            item.deal_amount,
            item.deposit,
            item.monthly_rent
        )
        if key not in existing_keys and key not in seen_in_batch:
            seen_in_batch.add(key)
            new_records.append(item)

    if not new_records:
        return 0

    # 3. 청크(Chunk) 단위 배치 저장
    total_saved = 0
    for i in range(0, len(new_records), CHUNK_SIZE):
        chunk = new_records[i:i + CHUNK_SIZE]
        db.add_all(chunk)
        await db.flush()  # DB 메모리 버퍼 플러시
        total_saved += len(chunk)

    await db.commit()  # 일괄 커밋
    return total_saved


# ==================== 1. 아파트 (매매 / 전월세) ====================

async def fetch_and_save_apt_trades(
    lawd_cd: str,
    deal_ymd: str,
    db: AsyncSession,
    session: Optional[aiohttp.ClientSession] = None
) -> int:
    """아파트 매매 실거래가 비동기 수집 및 Batch 적재"""
    print(f"📡 [아파트-매매] 비동기 API 호출 중... ({lawd_cd}, {deal_ymd})")
    should_close = False
    if session is None:
        session = aiohttp.ClientSession()
        should_close = True

    try:
        xml_str = await request_molit_xml_async(session, ENDPOINT_APT_TRADE, lawd_cd, deal_ymd)
        items = parse_xml_to_items(xml_str)
        candidates = []
        for it in items:
            apt_nm = (it.get("단지명") or it.get("아파트") or it.get("aptNm") or "").strip()
            if not apt_nm:
                continue
            deal_amount = clean_int(it.get("거래금액") or it.get("dealAmount"))
            exclu_ar = clean_float(it.get("전용면적") or it.get("excluUseAr"))
            base = extract_base_fields(it, lawd_cd, deal_ymd)
            r, b = infer_rooms_and_bathrooms(exclu_ar, "아파트")

            candidates.append(ApartmentTrade(
                property_type="아파트",
                trade_type="매매",
                apt_name=apt_nm,
                regional_code=lawd_cd,
                exclu_use_ar=exclu_ar,
                deal_amount=deal_amount,
                deposit=None,
                monthly_rent=0,
                rooms=r,
                bathrooms=b,
                **base
            ))

        saved = await batch_upsert_trades(db, "아파트", "매매", lawd_cd, candidates)
        print(f"✅ [아파트-매매] {saved}건 비동기 신규 적재 완료.")
        return saved
    finally:
        if should_close:
            await session.close()


async def fetch_and_save_apt_rents(
    lawd_cd: str,
    deal_ymd: str,
    db: AsyncSession,
    session: Optional[aiohttp.ClientSession] = None
) -> int:
    """아파트 전월세 실거래가 비동기 수집 및 Batch 적재"""
    print(f"📡 [아파트-전월세] 비동기 API 호출 중... ({lawd_cd}, {deal_ymd})")
    should_close = False
    if session is None:
        session = aiohttp.ClientSession()
        should_close = True

    try:
        xml_str = await request_molit_xml_async(session, ENDPOINT_APT_RENT, lawd_cd, deal_ymd)
        items = parse_xml_to_items(xml_str)
        jeonse_candidates = []
        wolse_candidates = []

        for it in items:
            apt_nm = (it.get("단지명") or it.get("아파트") or it.get("aptNm") or "").strip()
            if not apt_nm:
                continue
            deposit = clean_int(it.get("보증금액") or it.get("deposit"))
            monthly_rent = clean_int(it.get("월세금액") or it.get("monthlyRent")) or 0
            trade_type = "월세" if monthly_rent > 0 else "전세"
            exclu_ar = clean_float(it.get("전용면적") or it.get("excluUseAr"))
            base = extract_base_fields(it, lawd_cd, deal_ymd)
            r, b = infer_rooms_and_bathrooms(exclu_ar, "아파트")

            model = ApartmentTrade(
                property_type="아파트",
                trade_type=trade_type,
                apt_name=apt_nm,
                regional_code=lawd_cd,
                exclu_use_ar=exclu_ar,
                deal_amount=None,
                deposit=deposit,
                monthly_rent=monthly_rent,
                rooms=r,
                bathrooms=b,
                **base
            )
            if trade_type == "월세":
                wolse_candidates.append(model)
            else:
                jeonse_candidates.append(model)

        saved_jeonse = await batch_upsert_trades(db, "아파트", "전세", lawd_cd, jeonse_candidates)
        saved_wolse = await batch_upsert_trades(db, "아파트", "월세", lawd_cd, wolse_candidates)
        total_saved = saved_jeonse + saved_wolse
        print(f"✅ [아파트-전월세] {total_saved}건 비동기 신규 적재 완료 (전세 {saved_jeonse}, 월세 {saved_wolse}).")
        return total_saved
    finally:
        if should_close:
            await session.close()


# ==================== 2. 오피스텔 (매매 / 전월세) ====================

async def fetch_and_save_offi_trades(
    lawd_cd: str,
    deal_ymd: str,
    db: AsyncSession,
    session: Optional[aiohttp.ClientSession] = None
) -> int:
    """오피스텔 매매 실거래가 비동기 수집 및 Batch 적재"""
    print(f"📡 [오피스텔-매매] 비동기 API 호출 중... ({lawd_cd}, {deal_ymd})")
    should_close = False
    if session is None:
        session = aiohttp.ClientSession()
        should_close = True

    try:
        xml_str = await request_molit_xml_async(session, ENDPOINT_OFFI_TRADE, lawd_cd, deal_ymd)
        items = parse_xml_to_items(xml_str)
        candidates = []
        for it in items:
            offi_nm = (it.get("단지명") or it.get("오피스텔") or it.get("offiNm") or it.get("bldNm") or "오피스텔").strip()
            deal_amount = clean_int(it.get("거래금액") or it.get("dealAmount"))
            exclu_ar = clean_float(it.get("전용면적") or it.get("excluUseAr"))
            base = extract_base_fields(it, lawd_cd, deal_ymd)
            r, b = infer_rooms_and_bathrooms(exclu_ar, "오피스텔")

            candidates.append(ApartmentTrade(
                property_type="오피스텔",
                trade_type="매매",
                apt_name=offi_nm,
                regional_code=lawd_cd,
                exclu_use_ar=exclu_ar,
                deal_amount=deal_amount,
                deposit=None,
                monthly_rent=0,
                rooms=r,
                bathrooms=b,
                **base
            ))

        saved = await batch_upsert_trades(db, "오피스텔", "매매", lawd_cd, candidates)
        print(f"✅ [오피스텔-매매] {saved}건 비동기 신규 적재 완료.")
        return saved
    finally:
        if should_close:
            await session.close()


async def fetch_and_save_offi_rents(
    lawd_cd: str,
    deal_ymd: str,
    db: AsyncSession,
    session: Optional[aiohttp.ClientSession] = None
) -> int:
    """오피스텔 전월세 실거래가 비동기 수집 및 Batch 적재"""
    print(f"📡 [오피스텔-전월세] 비동기 API 호출 중... ({lawd_cd}, {deal_ymd})")
    should_close = False
    if session is None:
        session = aiohttp.ClientSession()
        should_close = True

    try:
        xml_str = await request_molit_xml_async(session, ENDPOINT_OFFI_RENT, lawd_cd, deal_ymd)
        items = parse_xml_to_items(xml_str)
        jeonse_candidates = []
        wolse_candidates = []

        for it in items:
            offi_nm = (it.get("단지명") or it.get("오피스텔") or it.get("offiNm") or it.get("bldNm") or "오피스텔").strip()
            deposit = clean_int(it.get("보증금액") or it.get("deposit"))
            monthly_rent = clean_int(it.get("월세금액") or it.get("monthlyRent")) or 0
            trade_type = "월세" if monthly_rent > 0 else "전세"
            exclu_ar = clean_float(it.get("전용면적") or it.get("excluUseAr"))
            base = extract_base_fields(it, lawd_cd, deal_ymd)
            r, b = infer_rooms_and_bathrooms(exclu_ar, "오피스텔")

            model = ApartmentTrade(
                property_type="오피스텔",
                trade_type=trade_type,
                apt_name=offi_nm,
                regional_code=lawd_cd,
                exclu_use_ar=exclu_ar,
                deal_amount=None,
                deposit=deposit,
                monthly_rent=monthly_rent,
                rooms=r,
                bathrooms=b,
                **base
            )
            if trade_type == "월세":
                wolse_candidates.append(model)
            else:
                jeonse_candidates.append(model)

        saved_jeonse = await batch_upsert_trades(db, "오피스텔", "전세", lawd_cd, jeonse_candidates)
        saved_wolse = await batch_upsert_trades(db, "오피스텔", "월세", lawd_cd, wolse_candidates)
        total_saved = saved_jeonse + saved_wolse
        print(f"✅ [오피스텔-전월세] {total_saved}건 비동기 신규 적재 완료.")
        return total_saved
    finally:
        if should_close:
            await session.close()


# ==================== 3. 연립다세대 (빌라 매매 / 전월세) ====================

async def fetch_and_save_rh_trades(
    lawd_cd: str,
    deal_ymd: str,
    db: AsyncSession,
    session: Optional[aiohttp.ClientSession] = None
) -> int:
    """연립다세대(빌라) 매매 실거래가 비동기 수집 및 Batch 적재"""
    print(f"📡 [연립다세대-매매] 비동기 API 호출 중... ({lawd_cd}, {deal_ymd})")
    should_close = False
    if session is None:
        session = aiohttp.ClientSession()
        should_close = True

    try:
        xml_str = await request_molit_xml_async(session, ENDPOINT_RH_TRADE, lawd_cd, deal_ymd)
        items = parse_xml_to_items(xml_str)
        candidates = []
        for it in items:
            mhouse_nm = (it.get("연립다세대") or it.get("연립다세대명") or it.get("mhouseNm") or "").strip()
            dong = (it.get("법정동") or it.get("umdNm") or "").strip()
            jibun = (it.get("지번") or it.get("jibun") or "").strip()
            if not mhouse_nm or mhouse_nm in ("연립다세대", "연립주택", "다세대주택"):
                if dong and jibun:
                    mhouse_nm = f"{dong} {jibun} (빌라/다세대)"
                elif dong:
                    mhouse_nm = f"{dong} 빌라/다세대"
                else:
                    mhouse_nm = "연립다세대(빌라)"
            deal_amount = clean_int(it.get("거래금액") or it.get("dealAmount"))
            exclu_ar = clean_float(it.get("전용면적") or it.get("대지권면적") or it.get("excluUseAr"))
            base = extract_base_fields(it, lawd_cd, deal_ymd)
            r, b = infer_rooms_and_bathrooms(exclu_ar, "연립다세대")

            candidates.append(ApartmentTrade(
                property_type="연립다세대",
                trade_type="매매",
                apt_name=mhouse_nm,
                regional_code=lawd_cd,
                exclu_use_ar=exclu_ar,
                deal_amount=deal_amount,
                deposit=None,
                monthly_rent=0,
                rooms=r,
                bathrooms=b,
                **base
            ))

        saved = await batch_upsert_trades(db, "연립다세대", "매매", lawd_cd, candidates)
        print(f"✅ [연립다세대-매매] {saved}건 비동기 신규 적재 완료.")
        return saved
    finally:
        if should_close:
            await session.close()


async def fetch_and_save_rh_rents(
    lawd_cd: str,
    deal_ymd: str,
    db: AsyncSession,
    session: Optional[aiohttp.ClientSession] = None
) -> int:
    """연립다세대(빌라) 전월세 실거래가 비동기 수집 및 Batch 적재"""
    print(f"📡 [연립다세대-전월세] 비동기 API 호출 중... ({lawd_cd}, {deal_ymd})")
    should_close = False
    if session is None:
        session = aiohttp.ClientSession()
        should_close = True

    try:
        xml_str = await request_molit_xml_async(session, ENDPOINT_RH_RENT, lawd_cd, deal_ymd)
        items = parse_xml_to_items(xml_str)
        jeonse_candidates = []
        wolse_candidates = []

        for it in items:
            mhouse_nm = (it.get("연립다세대") or it.get("연립다세대명") or it.get("mhouseNm") or "").strip()
            dong = (it.get("법정동") or it.get("umdNm") or "").strip()
            jibun = (it.get("지번") or it.get("jibun") or "").strip()
            if not mhouse_nm or mhouse_nm in ("연립다세대", "연립주택", "다세대주택"):
                if dong and jibun:
                    mhouse_nm = f"{dong} {jibun} (빌라/다세대)"
                elif dong:
                    mhouse_nm = f"{dong} 빌라/다세대"
                else:
                    mhouse_nm = "연립다세대(빌라)"
            deposit = clean_int(it.get("보증금액") or it.get("deposit"))
            monthly_rent = clean_int(it.get("월세금액") or it.get("monthlyRent")) or 0
            trade_type = "월세" if monthly_rent > 0 else "전세"
            exclu_ar = clean_float(it.get("전용면적") or it.get("excluUseAr"))
            base = extract_base_fields(it, lawd_cd, deal_ymd)
            r, b = infer_rooms_and_bathrooms(exclu_ar, "연립다세대")

            model = ApartmentTrade(
                property_type="연립다세대",
                trade_type=trade_type,
                apt_name=mhouse_nm,
                regional_code=lawd_cd,
                exclu_use_ar=exclu_ar,
                deal_amount=None,
                deposit=deposit,
                monthly_rent=monthly_rent,
                rooms=r,
                bathrooms=b,
                **base
            )
            if trade_type == "월세":
                wolse_candidates.append(model)
            else:
                jeonse_candidates.append(model)

        saved_jeonse = await batch_upsert_trades(db, "연립다세대", "전세", lawd_cd, jeonse_candidates)
        saved_wolse = await batch_upsert_trades(db, "연립다세대", "월세", lawd_cd, wolse_candidates)
        total_saved = saved_jeonse + saved_wolse
        print(f"✅ [연립다세대-전월세] {total_saved}건 비동기 신규 적재 완료.")
        return total_saved
    finally:
        if should_close:
            await session.close()


# ==================== 4. 단독/다가구 (원룸·투룸·단독주택 매매 / 전월세) ====================

async def fetch_and_save_sh_trades(
    lawd_cd: str,
    deal_ymd: str,
    db: AsyncSession,
    session: Optional[aiohttp.ClientSession] = None
) -> int:
    """단독/다가구 매매 실거래가 비동기 수집 및 Batch 적재"""
    print(f"📡 [단독다가구-매매] 비동기 API 호출 중... ({lawd_cd}, {deal_ymd})")
    should_close = False
    if session is None:
        session = aiohttp.ClientSession()
        should_close = True

    try:
        xml_str = await request_molit_xml_async(session, ENDPOINT_SH_TRADE, lawd_cd, deal_ymd)
        items = parse_xml_to_items(xml_str)
        candidates = []
        for it in items:
            house_type = (it.get("주택유형") or it.get("houseType") or "단독주택").strip()
            dong = (it.get("법정동") or it.get("umdNm") or "").strip()
            jibun = (it.get("지번") or it.get("jibun") or "").strip()
            if dong and jibun:
                sh_nm = f"{dong} {jibun} ({house_type})".strip()
            elif dong:
                sh_nm = f"{dong} {house_type}".strip()
            else:
                sh_nm = house_type

            deal_amount = clean_int(it.get("거래금액") or it.get("dealAmount"))
            exclu_ar = clean_float(it.get("totalFloorAr") or it.get("plottageAr") or it.get("연면적") or it.get("대지면적") or it.get("totArea") or 80.0)
            base = extract_base_fields(it, lawd_cd, deal_ymd)
            base["floor"] = base["floor"] or 1
            r, b = infer_rooms_and_bathrooms(exclu_ar, "단독다가구")

            candidates.append(ApartmentTrade(
                property_type="단독다가구",
                trade_type="매매",
                apt_name=sh_nm,
                regional_code=lawd_cd,
                exclu_use_ar=exclu_ar,
                deal_amount=deal_amount,
                deposit=None,
                monthly_rent=0,
                rooms=r,
                bathrooms=b,
                **base
            ))

        saved = await batch_upsert_trades(db, "단독다가구", "매매", lawd_cd, candidates)
        print(f"✅ [단독다가구-매매] {saved}건 비동기 신규 적재 완료.")
        return saved
    finally:
        if should_close:
            await session.close()


async def fetch_and_save_sh_rents(
    lawd_cd: str,
    deal_ymd: str,
    db: AsyncSession,
    session: Optional[aiohttp.ClientSession] = None
) -> int:
    """단독/다가구 전월세 실거래가 비동기 수집 및 Batch 적재"""
    print(f"📡 [단독다가구-전월세] 비동기 API 호출 중... ({lawd_cd}, {deal_ymd})")
    should_close = False
    if session is None:
        session = aiohttp.ClientSession()
        should_close = True

    try:
        xml_str = await request_molit_xml_async(session, ENDPOINT_SH_RENT, lawd_cd, deal_ymd)
        items = parse_xml_to_items(xml_str)
        jeonse_candidates = []
        wolse_candidates = []

        for it in items:
            house_type = (it.get("주택유형") or it.get("houseType") or "다가구/원룸").strip()
            dong = (it.get("법정동") or it.get("umdNm") or "").strip()
            jibun = (it.get("지번") or it.get("jibun") or "").strip()
            if dong and jibun:
                sh_nm = f"{dong} {jibun} ({house_type})".strip()
            elif dong:
                sh_nm = f"{dong} {house_type}".strip()
            else:
                sh_nm = house_type

            deposit = clean_int(it.get("보증금액") or it.get("deposit"))
            monthly_rent = clean_int(it.get("월세금액") or it.get("monthlyRent")) or 0
            trade_type = "월세" if monthly_rent > 0 else "전세"
            exclu_ar = clean_float(it.get("계약면적") or it.get("전용면적") or it.get("rentArea") or 33.0)
            base = extract_base_fields(it, lawd_cd, deal_ymd)
            base["floor"] = base["floor"] or 1
            r, b = infer_rooms_and_bathrooms(exclu_ar, "단독다가구")

            model = ApartmentTrade(
                property_type="단독다가구",
                trade_type=trade_type,
                apt_name=sh_nm,
                regional_code=lawd_cd,
                exclu_use_ar=exclu_ar,
                deal_amount=None,
                deposit=deposit,
                monthly_rent=monthly_rent,
                rooms=r,
                bathrooms=b,
                **base
            )
            if trade_type == "월세":
                wolse_candidates.append(model)
            else:
                jeonse_candidates.append(model)

        saved_jeonse = await batch_upsert_trades(db, "단독다가구", "전세", lawd_cd, jeonse_candidates)
        saved_wolse = await batch_upsert_trades(db, "단독다가구", "월세", lawd_cd, wolse_candidates)
        total_saved = saved_jeonse + saved_wolse
        print(f"✅ [단독다가구-전월세] {total_saved}건 비동기 신규 적재 완료.")
        return total_saved
    finally:
        if should_close:
            await session.close()


# ==================== 4대 주택유형 통합 비동기 ETL 마스터 실행기 ====================

async def run_integrated_etl(lawd_cd: str = "11680", deal_ymd: str = "202410"):
    """
    국토교통부 4대 주택유형 (아파트, 오피스텔, 연립다세대, 단독다가구)의
    매매 및 전월세 실거래가 데이터를 모두 비동기 수집하여 DB에 적재합니다.
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    print("=" * 60)
    print(f"🚀 국토교통부 4대 주택유형 통합 비동기 ETL 파이프라인 가동")
    print(f"📍 지역코드: {lawd_cd} (강남구 등) | 계약년월: {deal_ymd}")
    print("=" * 60)

    summary = {}
    async with SessionLocal() as db:
        async with aiohttp.ClientSession() as session:
            try:
                # 1. 아파트
                summary["아파트_매매"] = await fetch_and_save_apt_trades(lawd_cd, deal_ymd, db, session)
                summary["아파트_전월세"] = await fetch_and_save_apt_rents(lawd_cd, deal_ymd, db, session)

                # 2. 오피스텔
                summary["오피스텔_매매"] = await fetch_and_save_offi_trades(lawd_cd, deal_ymd, db, session)
                summary["오피스텔_전월세"] = await fetch_and_save_offi_rents(lawd_cd, deal_ymd, db, session)

                # 3. 연립다세대
                summary["연립다세대_매매"] = await fetch_and_save_rh_trades(lawd_cd, deal_ymd, db, session)
                summary["연립다세대_전월세"] = await fetch_and_save_rh_rents(lawd_cd, deal_ymd, db, session)

                # 4. 단독/다가구
                summary["단독다가구_매매"] = await fetch_and_save_sh_trades(lawd_cd, deal_ymd, db, session)
                summary["단독다가구_전월세"] = await fetch_and_save_sh_rents(lawd_cd, deal_ymd, db, session)

                total_new = sum(summary.values())
                res = await db.execute(select(func.count(ApartmentTrade.id)))
                total_in_db = res.scalar() or 0

                print("\n" + "=" * 60)
                print(f"🎉 [통합 비동기 ETL 완료] 신규 적재: {total_new}건 | 전체 DB 누적 레코드: {total_in_db}건")
                print("📊 [유형별 신규 적재 현황]")
                for k, v in summary.items():
                    print(f"  • {k:15s}: {v:4d}건")
                print("=" * 60)

            except Exception as e:
                print(f"❌ ETL 실행 중 오류 발생: {e}")
                await db.rollback()


if __name__ == "__main__":
    asyncio.run(run_integrated_etl(lawd_cd="11680", deal_ymd="202410"))
