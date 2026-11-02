# 🏢 집뷰(ZipView) - 국토교통부 실거래가 기반 부동산 프롭테크 플랫폼

> **국토교통부 8종 공공 API 통합 ETL**, **Multi-LLM(Gemini 1.5 & GPT-4o) 부동산 상담 에이전트**, 그리고 **토스(Toss) 디자인 시스템 기반 모던 대시보드**를 결합한 풀스택 부동산 분석 플랫폼입니다.

---

## 🌟 주요 기능

### 1. 국토교통부 실거래 데이터 통합 ETL (`fetch_api.py`)
- **4대 주거 유형 매매 & 전월세 8종 API 지원**:
  - 아파트 (`RTMSDataSvcAptTrade`, `RTMSDataSvcAptRent`)
  - 오피스텔 (`RTMSDataSvcOffiTrade`, `RTMSDataSvcOffiRent`)
  - 연립다세대 (`RTMSDataSvcRHTrade`, `RTMSDataSvcRHRent`)
  - 단독다가구 (`RTMSDataSvcSHTrade`, `RTMSDataSvcSHRent`)
- 전용면적 기반 방/화장실 가상 자동 매핑 추정 로직 내장 (`infer_rooms_and_bathrooms`).
- SQLite 기반 고속 조회 인덱싱 및 SQLAlchemy ORM 관리.

### 2. Multi-LLM 부동산 분석 에이전트 (`ai_agent.py`)
- **OpenAI (GPT-4o) & Google (Gemini 1.5) 듀얼 엔진 지원** (Factory Pattern 적용).
- **Function Calling 도구**:
  - `search_recent_price`: 특정 단지의 최근 5건 실거래가 및 최고/최저가 분석.
  - `find_affordable_apt`: 예산(최대 금액) 이하 실거래 매물 검색.
  - `search_custom_properties`: "자본 3억, 보증금 1억 미만 방 3개 화장실 2개"와 같은 자연어 복합 조건을 파싱하여 DB 매물 추천.
- 네트워크/환경 장애 시에도 로컬 DB에 질의하는 스마트 폴백 엔진 탑재.

### 3. FastAPI 백엔드 REST API (`main.py`)
- `GET /api/trades/{regional_code}`: 지역코드 및 단지명별 실거래 계약 내역(100건) 및 월별 차트 데이터 제공.
- `POST /api/chat`: 프론트엔드 자연어 프롬프트를 받아 Multi-LLM Function Calling 수행 후 자연어 브리핑 반환.
- CORS 미들웨어 적용 (`http://localhost:3000`, `http://localhost:5173` 등).

### 4. 프론트엔드 대시보드 (`index.html`, `TossStyleRealEstateDashboard.jsx`)
- **토스(Toss) 디자인 시스템 적용**:
  - 전체 배경 `bg-[#F2F4F6]`, 새하얀 둥근 카드 `rounded-[24px]`.
  - 대형 볼드 가격 폰트 (`text-4xl font-extrabold`) 및 토스 블루 포인트(`text-[#3182F6]`).
- **아파트 1:1 맞대결 (VS) 비교 카드**: 2개 단지의 세대수, 전세가율, 평당가, 스펙을 나란히 비교하는 바 게이지.
- **토스 주식 스타일 미니멀 실거래가 차트**: 축 선을 없앤 부드러운 그라디언트 에어리어 차트.
- **플로팅 'Gemini AI 상담' 챗봇**: 고객센터 스타일의 둥근 말풍선 UI.

---

## 🚀 빠른 시작 가이드

### 1. 환경 변수 설정
```bash
cp .env.example .env
# .env 파일에 OPENAI_API_KEY, GEMINI_API_KEY, MOLIT_API_KEY 입력
```

### 2. 파이썬 의존성 설치 및 백엔드 실행 (포트 8000)
```bash
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

### 3. 프론트엔드 웹 서버 실행 (포트 3000)
```bash
npm start
# 브라우저에서 http://localhost:3000 접속
```

### 4. 국토교통부 공공 데이터 수집 (ETL 실행)
```bash
# 서울시 강남구(11680) 2024년 10월 통합 데이터 수집
python -c "from fetch_api import run_integrated_etl; run_integrated_etl('11680', '202410')"
```

---

## 📁 프로젝트 구조

```text
├── index.html                       # 토스 스타일 메인 대시보드 (라이브 서빙)
├── index_legacy.html                # 구버전 지도 중심 랜딩 페이지 백업
├── TossStyleRealEstateDashboard.jsx # 토스 스타일 React 컴포넌트
├── RealEstateDashboard.jsx          # B2B SaaS 대시보드 React 컴포넌트
├── main.py                          # FastAPI REST API 백엔드
├── ai_agent.py                      # Multi-LLM (GPT-4o / Gemini) 에이전트
├── models.py                        # SQLAlchemy DB 모델 (방/욕실/건물유형)
├── database.py                      # SQLite 세션 및 엔진 관리
├── fetch_api.py                     # 국토교통부 8종 실거래가 공공 API ETL
├── real_estate.db                   # 국토교통부 실거래 로컬 SQLite DB
├── server.js                        # Node.js 정적 웹 서빙 서버
├── app.js                           # 구버전 인터랙티브 클라이언트 스크립트
├── styles.css                       # 구버전 스타일시트
├── requirements.txt                 # 파이썬 의존성 패키지 목록
└── package.json                     # Node.js 프로젝트 메타데이터
```

