from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Index, JSON, Text
from database import Base

def infer_rooms_and_bathrooms(exclu_use_ar: float, property_type: str = "아파트") -> tuple[int, int]:
    """
    공공 API에는 방/화장실 정보가 없으므로 전용면적(㎡) 및 건물유형 기준 자동 추정 매핑
    - 전용면적 84㎡ 이상 ➜ 방 3개 (또는 대형 4개), 화장실 2개
    - 전용면적 59㎡ 이상 ~ 84㎡ 미만 ➜ 방 3개, 화장실 1개
    - 전용면적 59㎡ 미만 ➜ 방 2개 이하 (원룸 1개), 화장실 1개
    """
    if exclu_use_ar is None:
        return (3, 1)
    
    ar = float(exclu_use_ar)
    ptype = property_type or "아파트"

    if ptype == "오피스텔":
        if ar < 35.0:
            return (1, 1) # 원룸형 오피스텔
        elif ar < 59.0:
            return (2, 1) # 1.5룸 / 투룸
        else:
            return (3, 2) # 주거용 아파텔 (전용 59㎡ 이상)
    elif ptype == "단독다가구":
        if ar < 30.0:
            return (1, 1) # 원룸
        elif ar < 60.0:
            return (2, 1) # 투룸
        else:
            return (3, 2) # 다가구 쓰리룸
    else: # 아파트 및 연립다세대
        if ar >= 84.0:
            return (4 if ar >= 114.0 else 3, 2) # 84㎡ 이상: 방 3~4개, 화장실 2개
        elif ar >= 59.0:
            return (3, 1)                       # 59㎡ ~ 84㎡ 미만: 방 3개, 화장실 1개
        else:
            return (1 if ar < 35.0 else 2, 1)   # 59㎡ 미만: 방 1~2개, 화장실 1개


class ApartmentTrade(Base):
    """
    부동산 실거래가 통합 테이블 (아파트, 오피스텔, 연립다세대, 단독다가구)
    국토교통부 매매 및 전월세 8종 공공 API 데이터 통합 적재
    """
    __tablename__ = "apartment_trade"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    
    # 건물 유형: '아파트', '오피스텔', '연립다세대', '단독다가구'
    property_type = Column(String(30), nullable=False, default="아파트", index=True)

    # 거래 유형: '매매', '전세', '월세'
    trade_type = Column(String(20), nullable=False, index=True)
    
    # 단지 및 위치 정보
    apt_name = Column(String(100), nullable=False, index=True)     # 건물명 / 단지명 (예: 은마, 루카831, 청담빌라)
    regional_code = Column(String(10), nullable=False, index=True) # 시군구코드 (LAWD_CD, 예: 11680)
    dong = Column(String(50), nullable=False, index=True)          # 법정동 (예: 대치동, 잠원동)
    jibun = Column(String(50), nullable=True)                      # 지번 (예: 316)
    
    # 면적 및 금액 정보 (금액 단위: 만원)
    exclu_use_ar = Column(Float, nullable=False)                   # 전용면적(㎡) / 대지면적
    deal_amount = Column(Integer, nullable=True)                   # 매매 거래금액 (만원, 매매일 때)
    deposit = Column(Integer, nullable=True)                       # 보증금 (만원, 전월세일 때)
    monthly_rent = Column(Integer, default=0)                      # 월세금액 (만원, 순수전세는 0)
    
    # 구조 정보 (전용면적 및 건물유형 기준 자동 산출)
    rooms = Column(Integer, default=3, index=True)                 # 방 개수 (1~4개)
    bathrooms = Column(Integer, default=1, index=True)             # 화장실 개수 (1~2개)

    # 계약 일자 정보
    deal_year = Column(Integer, nullable=False, index=True)        # 계약년도
    deal_month = Column(Integer, nullable=False, index=True)       # 계약월
    deal_day = Column(Integer, nullable=False)                     # 계약일
    deal_date = Column(String(10), nullable=False, index=True)     # YYYY-MM-DD 형식 (정렬 및 차트 렌더링용)
    
    # 건물 및 거래 상세
    floor = Column(Integer, nullable=True)                         # 층수 (단독/다가구는 1 또는 None)
    build_year = Column(Integer, nullable=True)                    # 건축년도
    cancel_deal_day = Column(String(20), nullable=True)            # 계약 해제일자 (취소 여부 확인)
    req_gbn = Column(String(50), nullable=True)                    # 거래유형 (중개거래/직거래)
    
    # 레코드 생성 일시
    created_at = Column(DateTime, default=datetime.utcnow)

    # 검색 최적화를 위한 복합 인덱스
    __table_args__ = (
        Index("ix_trade_lookup", "property_type", "regional_code", "trade_type", "deal_date"),
        Index("ix_apt_lookup", "regional_code", "apt_name", "trade_type", "deal_date"),
    )

    def __init__(self, **kwargs):
        # 방과 화장실 개수가 지정되지 않은 경우 전용면적과 건물유형으로 자동 계산
        if "exclu_use_ar" in kwargs:
            p_type = kwargs.get("property_type", "아파트")
            r, b = infer_rooms_and_bathrooms(kwargs["exclu_use_ar"], p_type)
            if "rooms" not in kwargs or kwargs["rooms"] is None:
                kwargs["rooms"] = r
            if "bathrooms" not in kwargs or kwargs["bathrooms"] is None:
                kwargs["bathrooms"] = b
        super().__init__(**kwargs)

    def __repr__(self):
        amount_desc = f"매매 {self.deal_amount}만원" if self.trade_type == "매매" else f"{self.trade_type} 보증금 {self.deposit}/월세 {self.monthly_rent}만원"
        return f"<ApartmentTrade([{self.property_type}] {self.deal_date} {self.apt_name} {self.floor}층 {self.exclu_use_ar}㎡ 방{self.rooms}/욕실{self.bathrooms} [{amount_desc}])>"


class PropertyListing(Base):
    """현재 거래 가능한 중개 매물. 과거 실거래 원장과 분리해 저장한다."""
    __tablename__ = "property_listing"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    status = Column(String(20), nullable=False, default="pending", index=True)
    property_type = Column(String(30), nullable=False, index=True)
    trade_type = Column(String(20), nullable=False, index=True)
    title = Column(String(160), nullable=False)
    description = Column(Text, nullable=False, default="")

    regional_code = Column(String(5), nullable=False, index=True)
    sido = Column(String(40), nullable=True)
    sigungu = Column(String(60), nullable=True)
    dong = Column(String(60), nullable=False, index=True)
    address = Column(String(240), nullable=False)
    building_name = Column(String(120), nullable=True, index=True)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)

    sale_price = Column(Integer, nullable=True)       # 만원 단위
    deposit = Column(Integer, nullable=True)          # 만원 단위
    monthly_rent = Column(Integer, nullable=True)     # 만원 단위
    maintenance_fee = Column(Integer, nullable=True)  # 만원 단위
    exclusive_area = Column(Float, nullable=False)    # ㎡
    supply_area = Column(Float, nullable=True)         # ㎡
    floor = Column(String(30), nullable=True)
    total_floors = Column(Integer, nullable=True)
    rooms = Column(Integer, nullable=True)
    bathrooms = Column(Integer, nullable=True)

    tags = Column(JSON, nullable=False, default=list)
    photos = Column(JSON, nullable=False, default=list)
    broker_office_name = Column(String(120), nullable=False)
    broker_name = Column(String(80), nullable=False)
    broker_phone = Column(String(30), nullable=False)
    broker_registration_number = Column(String(80), nullable=False)

    published_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True, index=True)
    last_verified_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("ix_listing_region_status_trade", "regional_code", "status", "trade_type"),
        Index("ix_listing_region_status_type", "regional_code", "status", "property_type"),
    )
