import os
import re
from datetime import datetime
from urllib.parse import unquote
import urllib.request
import urllib.parse
from dotenv import load_dotenv

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
ENDPOINT_RH_TRADE = os.getenv("MOLIT_ENDPOINT_RH_TRADE", "https://apis.data.go.kr/1613000/RTMSDataSvcRHTrade/getRTMSDataSvcRHTrade")
ENDPOINT_RH_RENT  = os.getenv("MOLIT_ENDPOINT_RH_RENT",  "https://apis.data.go.kr/1613000/RTMSDataSvcRHRent/getRTMSDataSvcRHRent")

# 4. 단독/다가구 (원룸·투룸·단독주택)
ENDPOINT_SH_TRADE = os.getenv("MOLIT_ENDPOINT_SH_TRADE", "https://apis.data.go.kr/1613000/RTMSDataSvcSHTrade/getRTMSDataSvcSHTrade")
ENDPOINT_SH_RENT  = os.getenv("MOLIT_ENDPOINT_SH_RENT",  "https://apis.data.go.kr/1613000/RTMSDataSvcSHRent/getRTMSDataSvcSHRent")


def clean_int(val):
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

def clean_float(val):
    """면적 등 소수점이 있는 값을 float로 안전하게 변환"""
    if val is None:
        return 0.0
    val_str = str(val).replace(",", "").strip()
    try:
        return float(val_str)
    except ValueError:
        return 0.0

def request_molit_xml(endpoint: str, lawd_cd: str, deal_ymd: str) -> str:
    """공공데이터포털 Open API 호출 및 XML 문자열 반환"""
    raw_key = unquote(MOLIT_API_KEY)
    params = {
        "serviceKey": raw_key,
        "LAWD_CD": lawd_cd,
        "DEAL_YMD": deal_ymd,
        "numOfRows": 1000,
        "pageNo": 1
    }
    url = f"{endpoint}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) RealEstateETL/2.0"}
    )
    with urllib.request.urlopen(req, timeout=20) as res:
        return res.read().decode("utf-8", errors="replace")

def parse_xml_to_items(xml_str: str) -> list:
    """XML 응답 파싱하여 items 목록(dict 리스트) 반환"""
    if xmltodict:
        data = xmltodict.parse(xml_str)
        try:
            items_obj = data.get("response", {}).get("body", {}).get("items", {})
            if not items_obj:
                return []
            item = items_obj.get("item", [])
            return [item] if isinstance(item, dict) else (item if isinstance(item, list) else [])
        except Exception:
            return []
    else:
        import xml.etree.ElementTree as ET
        root = ET.fromstring(xml_str)
        items = []
        for item_el in root.findall(".//item"):
            row = {child.tag: child.text for child in item_el}
            items.append(row)
        return items

def extract_base_fields(it: dict, lawd_cd: str, deal_ymd: str):
    """모든 주택유형에서 공통으로 사용되는 일자, 층수, 동, 지번 등을 추출"""
    year = clean_int(it.get("년") or it.get("dealYear")) or int(deal_ymd[:4])
    month = clean_int(it.get("월") or it.get("dealMonth")) or int(deal_ymd[4:6])
    day = clean_int(it.get("일") or it.get("dealDay")) or 1
    deal_date = f"{year:04d}-{month:02d}-{day:02d}"
    floor = clean_int(it.get("층") or it.get("floor"))
    dong = (it.get("법정동") or it.get("umdNm") or "").strip()
    jibun = (it.get("지번") or it.get("jibun") or "").strip()
    build_year = clean_int(it.get("건축년도") or it.get("buildYear"))
    cancel_deal_day = (it.get("해제사유발생일") or it.get("cancelDealDay") or "").strip()
    req_gbn = (it.get("거래유형") or it.get("reqGbn") or "").strip()

    return {
        "deal_year": year, "deal_month": month, "deal_day": day, "deal_date": deal_date,
        "floor": floor, "dong": dong, "jibun": jibun, "build_year": build_year,
        "cancel_deal_day": cancel_deal_day or None, "req_gbn": req_gbn or None
    }


# ==================== 1. 아파트 (매매 / 전월세) ====================

def fetch_and_save_apt_trades(lawd_cd: str, deal_ymd: str, db) -> int:
    """아파트 매매 실거래가 수집 및 적재"""
    print(f"📡 [아파트-매매] API 호출 중... ({lawd_cd}, {deal_ymd})")
    items = parse_xml_to_items(request_molit_xml(ENDPOINT_APT_TRADE, lawd_cd, deal_ymd))
    saved = 0
    for it in items:
        apt_nm = (it.get("단지명") or it.get("아파트") or it.get("aptNm") or "").strip()
        if not apt_nm: continue
        deal_amount = clean_int(it.get("거래금액") or it.get("dealAmount"))
        exclu_ar = clean_float(it.get("전용면적") or it.get("excluUseAr"))
        base = extract_base_fields(it, lawd_cd, deal_ymd)

        exists = db.query(ApartmentTrade).filter_by(
            property_type="아파트", trade_type="매매", regional_code=lawd_cd,
            apt_name=apt_nm, deal_date=base["deal_date"], floor=base["floor"], deal_amount=deal_amount
        ).first()

        if not exists:
            r, b = infer_rooms_and_bathrooms(exclu_ar, "아파트")
            db.add(ApartmentTrade(
                property_type="아파트", trade_type="매매", apt_name=apt_nm, regional_code=lawd_cd,
                exclu_use_ar=exclu_ar, deal_amount=deal_amount, deposit=None, monthly_rent=0,
                rooms=r, bathrooms=b, **base
            ))
            saved += 1
    db.commit()
    print(f"✅ [아파트-매매] {saved}건 신규 적재 완료.")
    return saved

def fetch_and_save_apt_rents(lawd_cd: str, deal_ymd: str, db) -> int:
    """아파트 전월세 실거래가 수집 및 적재"""
    print(f"📡 [아파트-전월세] API 호출 중... ({lawd_cd}, {deal_ymd})")
    items = parse_xml_to_items(request_molit_xml(ENDPOINT_APT_RENT, lawd_cd, deal_ymd))
    saved = 0
    for it in items:
        apt_nm = (it.get("단지명") or it.get("아파트") or it.get("aptNm") or "").strip()
        if not apt_nm: continue
        deposit = clean_int(it.get("보증금액") or it.get("deposit"))
        monthly_rent = clean_int(it.get("월세금액") or it.get("monthlyRent")) or 0
        trade_type = "월세" if monthly_rent > 0 else "전세"
        exclu_ar = clean_float(it.get("전용면적") or it.get("excluUseAr"))
        base = extract_base_fields(it, lawd_cd, deal_ymd)

        exists = db.query(ApartmentTrade).filter_by(
            property_type="아파트", trade_type=trade_type, regional_code=lawd_cd,
            apt_name=apt_nm, deal_date=base["deal_date"], floor=base["floor"], deposit=deposit, monthly_rent=monthly_rent
        ).first()

        if not exists:
            r, b = infer_rooms_and_bathrooms(exclu_ar, "아파트")
            db.add(ApartmentTrade(
                property_type="아파트", trade_type=trade_type, apt_name=apt_nm, regional_code=lawd_cd,
                exclu_use_ar=exclu_ar, deal_amount=None, deposit=deposit, monthly_rent=monthly_rent,
                rooms=r, bathrooms=b, **base
            ))
            saved += 1
    db.commit()
    print(f"✅ [아파트-전월세] {saved}건 신규 적재 완료.")
    return saved


# ==================== 2. 오피스텔 (매매 / 전월세) ====================

def fetch_and_save_offi_trades(lawd_cd: str, deal_ymd: str, db) -> int:
    """오피스텔 매매 실거래가 수집 및 적재"""
    print(f"📡 [오피스텔-매매] API 호출 중... ({lawd_cd}, {deal_ymd})")
    items = parse_xml_to_items(request_molit_xml(ENDPOINT_OFFI_TRADE, lawd_cd, deal_ymd))
    saved = 0
    for it in items:
        offi_nm = (it.get("단지명") or it.get("오피스텔") or it.get("offiNm") or it.get("bldNm") or "오피스텔").strip()
        deal_amount = clean_int(it.get("거래금액") or it.get("dealAmount"))
        exclu_ar = clean_float(it.get("전용면적") or it.get("excluUseAr"))
        base = extract_base_fields(it, lawd_cd, deal_ymd)

        exists = db.query(ApartmentTrade).filter_by(
            property_type="오피스텔", trade_type="매매", regional_code=lawd_cd,
            apt_name=offi_nm, deal_date=base["deal_date"], floor=base["floor"], deal_amount=deal_amount
        ).first()

        if not exists:
            r, b = infer_rooms_and_bathrooms(exclu_ar, "오피스텔")
            db.add(ApartmentTrade(
                property_type="오피스텔", trade_type="매매", apt_name=offi_nm, regional_code=lawd_cd,
                exclu_use_ar=exclu_ar, deal_amount=deal_amount, deposit=None, monthly_rent=0,
                rooms=r, bathrooms=b, **base
            ))
            saved += 1
    db.commit()
    print(f"✅ [오피스텔-매매] {saved}건 신규 적재 완료.")
    return saved

def fetch_and_save_offi_rents(lawd_cd: str, deal_ymd: str, db) -> int:
    """오피스텔 전월세 실거래가 수집 및 적재"""
    print(f"📡 [오피스텔-전월세] API 호출 중... ({lawd_cd}, {deal_ymd})")
    items = parse_xml_to_items(request_molit_xml(ENDPOINT_OFFI_RENT, lawd_cd, deal_ymd))
    saved = 0
    for it in items:
        offi_nm = (it.get("단지명") or it.get("오피스텔") or it.get("offiNm") or it.get("bldNm") or "오피스텔").strip()
        deposit = clean_int(it.get("보증금액") or it.get("deposit"))
        monthly_rent = clean_int(it.get("월세금액") or it.get("monthlyRent")) or 0
        trade_type = "월세" if monthly_rent > 0 else "전세"
        exclu_ar = clean_float(it.get("전용면적") or it.get("excluUseAr"))
        base = extract_base_fields(it, lawd_cd, deal_ymd)

        exists = db.query(ApartmentTrade).filter_by(
            property_type="오피스텔", trade_type=trade_type, regional_code=lawd_cd,
            apt_name=offi_nm, deal_date=base["deal_date"], floor=base["floor"], deposit=deposit, monthly_rent=monthly_rent
        ).first()

        if not exists:
            r, b = infer_rooms_and_bathrooms(exclu_ar, "오피스텔")
            db.add(ApartmentTrade(
                property_type="오피스텔", trade_type=trade_type, apt_name=offi_nm, regional_code=lawd_cd,
                exclu_use_ar=exclu_ar, deal_amount=None, deposit=deposit, monthly_rent=monthly_rent,
                rooms=r, bathrooms=b, **base
            ))
            saved += 1
    db.commit()
    print(f"✅ [오피스텔-전월세] {saved}건 신규 적재 완료.")
    return saved


# ==================== 3. 연립다세대 (빌라 매매 / 전월세) ====================

def fetch_and_save_rh_trades(lawd_cd: str, deal_ymd: str, db) -> int:
    """연립다세대 매매 실거래가 수집 및 적재"""
    print(f"📡 [연립다세대-매매] API 호출 중... ({lawd_cd}, {deal_ymd})")
    items = parse_xml_to_items(request_molit_xml(ENDPOINT_RH_TRADE, lawd_cd, deal_ymd))
    saved = 0
    for it in items:
        mhouse_nm = (it.get("연립다세대") or it.get("연립다세대명") or it.get("mhouseNm") or "연립다세대").strip()
        deal_amount = clean_int(it.get("거래금액") or it.get("dealAmount"))
        exclu_ar = clean_float(it.get("전용면적") or it.get("대지권면적") or it.get("excluUseAr"))
        base = extract_base_fields(it, lawd_cd, deal_ymd)

        exists = db.query(ApartmentTrade).filter_by(
            property_type="연립다세대", trade_type="매매", regional_code=lawd_cd,
            apt_name=mhouse_nm, deal_date=base["deal_date"], floor=base["floor"], deal_amount=deal_amount
        ).first()

        if not exists:
            r, b = infer_rooms_and_bathrooms(exclu_ar, "연립다세대")
            db.add(ApartmentTrade(
                property_type="연립다세대", trade_type="매매", apt_name=mhouse_nm, regional_code=lawd_cd,
                exclu_use_ar=exclu_ar, deal_amount=deal_amount, deposit=None, monthly_rent=0,
                rooms=r, bathrooms=b, **base
            ))
            saved += 1
    db.commit()
    print(f"✅ [연립다세대-매매] {saved}건 신규 적재 완료.")
    return saved

def fetch_and_save_rh_rents(lawd_cd: str, deal_ymd: str, db) -> int:
    """연립다세대 전월세 실거래가 수집 및 적재"""
    print(f"📡 [연립다세대-전월세] API 호출 중... ({lawd_cd}, {deal_ymd})")
    items = parse_xml_to_items(request_molit_xml(ENDPOINT_RH_RENT, lawd_cd, deal_ymd))
    saved = 0
    for it in items:
        mhouse_nm = (it.get("연립다세대") or it.get("연립다세대명") or it.get("mhouseNm") or "연립다세대").strip()
        deposit = clean_int(it.get("보증금액") or it.get("deposit"))
        monthly_rent = clean_int(it.get("월세금액") or it.get("monthlyRent")) or 0
        trade_type = "월세" if monthly_rent > 0 else "전세"
        exclu_ar = clean_float(it.get("전용면적") or it.get("excluUseAr"))
        base = extract_base_fields(it, lawd_cd, deal_ymd)

        exists = db.query(ApartmentTrade).filter_by(
            property_type="연립다세대", trade_type=trade_type, regional_code=lawd_cd,
            apt_name=mhouse_nm, deal_date=base["deal_date"], floor=base["floor"], deposit=deposit, monthly_rent=monthly_rent
        ).first()

        if not exists:
            r, b = infer_rooms_and_bathrooms(exclu_ar, "연립다세대")
            db.add(ApartmentTrade(
                property_type="연립다세대", trade_type=trade_type, apt_name=mhouse_nm, regional_code=lawd_cd,
                exclu_use_ar=exclu_ar, deal_amount=None, deposit=deposit, monthly_rent=monthly_rent,
                rooms=r, bathrooms=b, **base
            ))
            saved += 1
    db.commit()
    print(f"✅ [연립다세대-전월세] {saved}건 신규 적재 완료.")
    return saved


# ==================== 4. 단독/다가구 (원룸·투룸·단독주택 매매 / 전월세) ====================

def fetch_and_save_sh_trades(lawd_cd: str, deal_ymd: str, db) -> int:
    """단독/다가구 매매 실거래가 수집 및 적재"""
    print(f"📡 [단독다가구-매매] API 호출 중... ({lawd_cd}, {deal_ymd})")
    items = parse_xml_to_items(request_molit_xml(ENDPOINT_SH_TRADE, lawd_cd, deal_ymd))
    saved = 0
    for it in items:
        house_type = (it.get("주택유형") or it.get("houseType") or "단독주택").strip()
        dong = (it.get("법정동") or it.get("umdNm") or "").strip()
        # 단독다가구는 단지명이 없으므로 법정동 + 주택유형으로 표기 (예: 대치동 단독주택)
        sh_nm = f"{dong} {house_type}".strip() if dong else house_type

        deal_amount = clean_int(it.get("거래금액") or it.get("dealAmount"))
        exclu_ar = clean_float(it.get("연면적") or it.get("대지면적") or it.get("totArea") or 80.0)
        base = extract_base_fields(it, lawd_cd, deal_ymd)
        base["floor"] = base["floor"] or 1

        exists = db.query(ApartmentTrade).filter_by(
            property_type="단독다가구", trade_type="매매", regional_code=lawd_cd,
            apt_name=sh_nm, deal_date=base["deal_date"], deal_amount=deal_amount
        ).first()

        if not exists:
            r, b = infer_rooms_and_bathrooms(exclu_ar, "단독다가구")
            db.add(ApartmentTrade(
                property_type="단독다가구", trade_type="매매", apt_name=sh_nm, regional_code=lawd_cd,
                exclu_use_ar=exclu_ar, deal_amount=deal_amount, deposit=None, monthly_rent=0,
                rooms=r, bathrooms=b, **base
            ))
            saved += 1
    db.commit()
    print(f"✅ [단독다가구-매매] {saved}건 신규 적재 완료.")
    return saved

def fetch_and_save_sh_rents(lawd_cd: str, deal_ymd: str, db) -> int:
    """단독/다가구 전월세 실거래가 수집 및 적재"""
    print(f"📡 [단독다가구-전월세] API 호출 중... ({lawd_cd}, {deal_ymd})")
    items = parse_xml_to_items(request_molit_xml(ENDPOINT_SH_RENT, lawd_cd, deal_ymd))
    saved = 0
    for it in items:
        house_type = (it.get("주택유형") or it.get("houseType") or "다가구/원룸").strip()
        dong = (it.get("법정동") or it.get("umdNm") or "").strip()
        sh_nm = f"{dong} {house_type}".strip() if dong else house_type

        deposit = clean_int(it.get("보증금액") or it.get("deposit"))
        monthly_rent = clean_int(it.get("월세금액") or it.get("monthlyRent")) or 0
        trade_type = "월세" if monthly_rent > 0 else "전세"
        exclu_ar = clean_float(it.get("계약면적") or it.get("전용면적") or it.get("rentArea") or 33.0)
        base = extract_base_fields(it, lawd_cd, deal_ymd)
        base["floor"] = base["floor"] or 1

        exists = db.query(ApartmentTrade).filter_by(
            property_type="단독다가구", trade_type=trade_type, regional_code=lawd_cd,
            apt_name=sh_nm, deal_date=base["deal_date"], deposit=deposit, monthly_rent=monthly_rent
        ).first()

        if not exists:
            r, b = infer_rooms_and_bathrooms(exclu_ar, "단독다가구")
            db.add(ApartmentTrade(
                property_type="단독다가구", trade_type=trade_type, apt_name=sh_nm, regional_code=lawd_cd,
                exclu_use_ar=exclu_ar, deal_amount=None, deposit=deposit, monthly_rent=monthly_rent,
                rooms=r, bathrooms=b, **base
            ))
            saved += 1
    db.commit()
    print(f"✅ [단독다가구-전월세] {saved}건 신규 적재 완료.")
    return saved


# ==================== 4대 주택유형 통합 ETL 마스터 실행기 ====================

def run_integrated_etl(lawd_cd: str = "11680", deal_ymd: str = "202410"):
    """
    국토교통부 4대 주택유형 (아파트, 오피스텔, 연립다세대, 단독다가구)의
    매매 및 전월세 실거래가 데이터를 모두 수집하여 SQLite DB에 적재합니다.
    """
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    print("=" * 60)
    print(f"🚀 국토교통부 4대 주택유형 통합 ETL 파이프라인 가동")
    print(f"📍 지역코드: {lawd_cd} (강남구 등) | 계약년월: {deal_ymd}")
    print("=" * 60)

    summary = {}
    try:
        # 1. 아파트
        summary["아파트_매매"] = fetch_and_save_apt_trades(lawd_cd, deal_ymd, db)
        summary["아파트_전월세"] = fetch_and_save_apt_rents(lawd_cd, deal_ymd, db)

        # 2. 오피스텔
        summary["오피스텔_매매"] = fetch_and_save_offi_trades(lawd_cd, deal_ymd, db)
        summary["오피스텔_전월세"] = fetch_and_save_offi_rents(lawd_cd, deal_ymd, db)

        # 3. 연립다세대
        summary["연립다세대_매매"] = fetch_and_save_rh_trades(lawd_cd, deal_ymd, db)
        summary["연립다세대_전월세"] = fetch_and_save_rh_rents(lawd_cd, deal_ymd, db)

        # 4. 단독/다가구
        summary["단독다가구_매매"] = fetch_and_save_sh_trades(lawd_cd, deal_ymd, db)
        summary["단독다가구_전월세"] = fetch_and_save_sh_rents(lawd_cd, deal_ymd, db)

        total_new = sum(summary.values())
        total_in_db = db.query(ApartmentTrade).count()

        print("\n" + "=" * 60)
        print(f"🎉 [통합 ETL 완료] 신규 적재: {total_new}건 | 전체 DB 누적 레코드: {total_in_db}건")
        print("📊 [유형별 신규 적재 현황]")
        for k, v in summary.items():
            print(f"  • {k:15s}: {v:4d}건")
        print("=" * 60)

    except Exception as e:
        print(f"❌ ETL 실행 중 오류 발생: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    # 로컬 테스트: 서울시 강남구(11680) 2024년 10월 4대 주택유형 실거래 데이터 일괄 적재
    run_integrated_etl(lawd_cd="11680", deal_ymd="202410")
