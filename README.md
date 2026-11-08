# 🏢 집뷰 (ZipView) - 엔터프라이즈 부동산 실거래가 인텔리전스 & AI 분석 플랫폼

<div align="center">

![ZipView Platform](https://img.shields.io/badge/Platform-ZipView_Enterprise-0F172A?style=for-the-badge&logo=probot&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React_18-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/Supabase_PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![Playwright](https://img.shields.io/badge/Playwright_E2E-2EAD33?style=for-the-badge&logo=playwright&logoColor=white)
![Pytest](https://img.shields.io/badge/Pytest_API-0A9EDC?style=for-the-badge&logo=pytest&logoColor=white)
![GitHub Actions](https://img.shields.io/badge/GitHub_Actions_CI-2088FF?style=for-the-badge&logo=github-actions&logoColor=white)

<p align="center">
  <strong>대한민국 전국 252개 시·군·구 국토교통부 실거래 원장 데이터와 Multi-LLM 기반 지능형 프롭테크 대시보드</strong><br>
  정형 통계 대시보드, 1:1 단지 스펙 비교 매트릭스, 카카오 지도 연동, 그리고 자연어 질의 기반 자율 상태 동기화 챗봇을 결합한 엔터프라이즈 B2B/B2C 솔루션입니다.
</p>

</div>

---

## 📑 목차 (Table of Contents)

1. [시스템 아키텍처 (System Architecture)](#-시스템-아키텍처-system-architecture)
2. [핵심 기능 (Key Features)](#-핵심-기능-key-features)
   - [전국 252개 시·군·구 전수 동적 레지스트리](#1-전국-252개-시군구-전수-동적-레지스트리)
   - [지능형 Multi-LLM AI 부동산 컨설턴트](#2-지능형-multi-llm-ai-부동산-컨설턴트)
   - [토스 스타일 엔터프라이즈 프론트엔드 대시보드](#3-토스-스타일-엔터프라이즈-프론트엔드-대시보드)
   - [고성능 캐싱 & 비동기 실시간 데이터 파이프라인](#4-고성능-캐싱--비동기-실시간-데이터-파이프라인)
   - [SEO 및 검색 엔진 최적화](#5-seo-및-검색-엔진-최적화)
3. [자동화 테스트 파이프라인 & CI/CD (Testing & CI/CD)](#-자동화-테스트-파이프라인--cicd)
   - [백엔드 API 통합 테스트 (Pytest)](#백엔드-api-통합-테스트-pytest)
   - [프론트엔드 E2E 테스트 (Playwright)](#프론트엔드-e2e-테스트-playwright)
   - [GitHub Actions CI 워크플로우](#github-actions-ci-워크플로우)
4. [프로젝트 디렉토리 구조 (Directory Structure)](#-프로젝트-디렉토리-구조-directory-structure)
5. [설치 및 로컬 실행 가이드 (Getting Started)](#-설치-및-로컬-실행-가이드-getting-started)
6. [환경 변수 설정 (Environment Variables)](#-환경-변수-설정-environment-variables)
7. [주요 API 명세 (API Specification)](#-주요-api-명세-api-specification)

---

## 🏛 시스템 아키텍처 (System Architecture)

```mermaid
flowchart TB
    subgraph Client ["Frontend (Browser)"]
        UI["TossStyleRealEstateDashboard.jsx\n(React 18 + TailwindCSS)"]
        ChatModal["플로팅 AI 상담 챗 모달\n(State Sync & Disambiguation)"]
        KakaoMap["카카오 지도 SDK\n(클러스터러 & 위치 핀포인트)"]
        Recharts["주식형 복합 차트 & 1:1 비교 매트릭스"]
    end

    subgraph Backend ["FastAPI Cloud Backend"]
        Router["FastAPI REST Router\n(/api/trades, /api/chat)"]
        Cache["1-Hour TTL In-Memory Cache\n(cachetools.TTLCache)"]
        Agent["Multi-LLM AI Agent\n(GPT-4o & Gemini 1.5)"]
        Registry["전국 252개 LAWD_CD 레지스트리\n(역색인 & 랜드마크 & 오타 교정)"]
        ETL["국토교통부 8종 실거래 API ETL\n(Fast Async Chunked Sync)"]
    end

    subgraph Storage ["Database & External Services"]
        Supabase[("Supabase PostgreSQL\n(ApartmentTrade 원장 DB)")]
        MOLIT["국토교통부 공공데이터 Open API\n(4대 주거유형 매매/전월세 8종)"]
        OpenAI["OpenAI API (GPT-4o / gpt-4o-mini)"]
    end

    UI <--> Router
    ChatModal <--> Router
    Router <--> Cache
    Router <--> Agent
    Agent <--> Registry
    Agent <--> Supabase
    Agent <--> OpenAI
    Router <--> Supabase
    ETL <--> MOLIT
    ETL <--> Supabase
```

---

## 🌟 핵심 기능 (Key Features)

### 1. 전국 252개 시·군·구 전수 동적 레지스트리
- **단 1바이트의 하드코딩 없는 완전 동적 매핑 (`zipview-backend/lawd_cd_registry.py`)**:
  - 대한민국 17개 시·도 산하 252개 전수 시·군·구 표준 5자리 법정동 코드(`LAWD_CD`) 완전 색인.
  - 창원시, 수원시, 고양시 등 0번 통합 행정시 코드 자동 분기 및 매핑 지원.
  - 전국 단위 동명(가좌동, 신월동, 구산동 등) 및 중복 구(서구, 중구, 남구, 강서구 등) 전수 역색인.
- **랜드마크 및 고의 오타 자동 교정 (Intelligent Correction)**:
  - "남강", "진주성", "촉석루" 등 지역 대표 랜드마크 입력 시 관할 시/군/구 자동 추론.
  - "혁샌도시 쪽은 읎어?"와 같은 오타/방언 질의 시 "충무공동(진주 혁신도시)"으로 자동 정규화 교정.

### 2. 지능형 Multi-LLM AI 부동산 컨설턴트
- **Text-to-SQL & RAG 파이프라인 (`zipview-backend/ai_agent.py`)**:
  - 사용자의 복합 자연어(법정동, 건물 유형, 거래 유형, 보증금/월세/매매가 상한선 등)를 정밀 파싱하여 실제 DB 조건문 생성 및 실시간 쿼리 수행.
- **전국 단위 범용 되묻기 (Global Disambiguation)**:
  - 전국에 동명이인이 있는 지명 입력 시 AI가 임의로 판단하지 않고 선택지 버튼과 함께 명확화 질의(`needs_clarification`) 모드로 전환.
- **다중 턴 세션 메모리 보존 (Session Memory Context Retention)**:
  - `SESSION_CONTEXT_CACHE`(1시간 TTL)를 통해 1차 질의 후 "그중에서 제일 최근에 거래된 건?"과 같은 후속 질의 시 직전 지역/거래유형 컨텍스트를 100% 보존.
- **양방향 UI/URL 상태 동기화 (State Sync)**:
  - 챗봇 질의 결과 타깃 지역이 변경되면 부모 대시보드의 시/도, 시/군/구 드롭다운 옵션 및 브라우저 URL 파라미터(`?lawdCd=...`)가 실시간으로 자율 전환.

### 3. 토스 스타일 엔터프라이즈 프론트엔드 대시보드
- **토스(Toss) 디자인 시스템 완벽 구현**:
  - Pretendard 타이포그래피, 슬레이트 톤 베이스 팔레트, 대형 볼드 가격 폰트, 미니멀 라운드 카드 디자인.
- **주식형 3개년 시세 추이 복합 차트 (Stock Multi-Chart)**:
  - 좌측 Y축(매매/전세 평균 시세 곡선)과 우측 Y축(월간 거래량 막대)을 결합한 인터랙티브 `ComposedChart`.
  - 전체 / 매매 / 전세 필터 탭 제공.
- **아파트 1:1 단지 스펙 맞대결 (VS) 비교 매트릭스**:
  - 단지 A vs 단지 B 간 평균 매매가, 전세가, 평당가, 전용면적, 갭투자 전세가율(%) 비교 바 차트 및 정밀 스펙 테이블.
- **카카오 지도 SDK 연동 실시간 핀포인트 & B2B 매물 모드**:
  - 지역 중심 좌표 이동, 거래 유형별 컬러 뱃지 핀포인트, 공인중개사 네트워크 검증 실시간 호가 매물 카드 리스트 전환.

### 4. 고성능 캐싱 & 비동기 실시간 데이터 파이프라인
- **FastAPI 인메모리 캐시 계층 (`cachetools.TTLCache`)**:
  - 동일한 지역 코드(`LAWD_CD`) 요청 시 1시간 TTL 동안 DB 쿼리 및 외부 API 조회를 생략하여 응답 속도 0.1초 이내 보장.
- **자율 실시간 데이터 주입 (Autonomous Data Injection)**:
  - 신규 지역 선택 시 3초 이내 렌더링을 위해 최신 1개월 데이터를 고속 동기화하고, 나머지 3개년 원장은 백그라운드 비동기 태스크로 분할 적재.

### 5. SEO 및 검색 엔진 최적화
- **동적 URL 파라미터 연동**:
  - 지역 변경 시 `?lawdCd=28260` 형태로 실시간 쿼리 스트링 갱신 및 `replaceState` 히스토리 관리.
- **메타데이터 & 검색 봇 대응**:
  - 대한민국 252개 시·군·구 Canonical URL 자동 맵핑.
  - [`robots.txt`](file:///c:/Users/82107/.gemini/antigravity/scratch/real-estate-web/robots.txt) 및 전국 252개 지역 전수 색인 [`sitemap.xml`](file:///c:/Users/82107/.gemini/antigravity/scratch/real-estate-web/dist/sitemap.xml) 배포.
  - 구글/네이버 봇 대응 Open Graph, Twitter Card, `schema.org` JSON-LD 정형 데이터 적용.

---

## 🧪 자동화 테스트 파이프라인 & CI/CD

상용화 무결성을 검증하기 위한 프론트엔드 및 백엔드 테스트 파이프라인이 구축되어 있습니다.

```mermaid
flowchart LR
    Push[Git Push / PR to main] --> Actions[GitHub Actions CI]
    subgraph CI_Jobs ["GitHub Actions Runners"]
        PytestJob["Backend Tests (Pytest)\n- TTL Cache Skip DB\n- 252 Region Routing\n- Landmark Inference\n- Session Memory"]
        PlaywrightJob["Frontend Tests (Playwright)\n- Headless Browser Bot\n- Chat-to-UI State Sync\n- Typo Auto-Correction\n- URL Param Sync"]
    end
    Actions --> PytestJob
    Actions --> PlaywrightJob
    PytestJob --> Deploy[Deploy to Production]
    PlaywrightJob --> Deploy
```

### 백엔드 API 통합 테스트 (Pytest)
[`tests/api/test_routes.py`](file:///c:/Users/82107/.gemini/antigravity/scratch/real-estate-web/tests/api/test_routes.py) (8개 시나리오 전수 검증):
1. `/api/chat` 응답 페이로드 내 `new_lawd_cd` 및 정규화 지역명 포함 검증
2. 1시간 TTL 인메모리 캐시 동작 검증 (2회차 호출 시 DB 쿼리 생략 카운트)
3. 전국 252개 지역 라우팅 파라미터 무결성 (제주 서귀포, 부산 해운대, 전남 여수, 강원 춘천)
4. **랜드마크 추론 검증**: `"진주 남강 근처 싼 전세 찾아줘"` -> 진주시(`48170`) 자동 라우팅
5. **세션 메모리 복원 검증**: 1차 질의 후 동일 세션에서 `"그중에서 제일 최근에 거래된 건?"` 질의 시 진주시/전세 조건 보존

```bash
# 백엔드 테스트 실행
python -m pytest tests/api/test_routes.py -v
```

### 프론트엔드 E2E 테스트 (Playwright)
[`tests/e2e/dashboard.spec.js`](file:///c:/Users/82107/.gemini/antigravity/scratch/real-estate-web/tests/e2e/dashboard.spec.js) (2개 핵심 인터랙션 시나리오):
1. **챗봇-대시보드 상태 동기화**: 브라우저 봇이 `"인천 서구 전세 찾아줘"` 질의 시 부모 드롭다운이 `인천광역시 서구(28260)`로 동기화되고 URL에 `lawdCd=28260` 갱신 확인.
2. **고의 오타 교정 & UI 스위칭**: `"혁샌도시 쪽은 읎어?"` 입력 시 챗봇이 `충무공동(진주 혁신도시)`으로 교정하고 부모 대시보드가 `경상남도 진주시(48170)`로 자동 스위칭 및 URL 갱신 확인.

```bash
# 프론트엔드 E2E 테스트 실행
npm run test:e2e
```

### GitHub Actions CI 워크플로우
[`.github/workflows/test.yml`](file:///c:/Users/82107/.gemini/antigravity/scratch/real-estate-web/.github/workflows/test.yml)을 통해 `main` 브랜치에 `push` 또는 `pull_request` 발생 시 Ubuntu 러너에서 Pytest 및 Playwright 스위트를 병렬 실행합니다.

---

## 📁 프로젝트 디렉토리 구조 (Directory Structure)

```text
real-estate-web/
├── .github/
│   └── workflows/
│       └── test.yml                 # GitHub Actions CI 파이프라인 설정
├── dist/                            # 프로덕션 번들 및 배포 아티팩트
│   ├── App.jsx
│   ├── index.html
│   ├── robots.txt
│   ├── sitemap.xml                  # 전국 252개 시군구 전수 검색엔진 색인 사이트맵
│   ├── styles.css
│   └── TossStyleRealEstateDashboard.jsx
├── tests/
│   ├── api/
│   │   └── test_routes.py           # FastAPI 백엔드 Pytest 통합 테스트 스위트
│   └── e2e/
│       └── dashboard.spec.js        # Playwright E2E 브라우저 자동화 테스트 스위트
├── zipview-backend/                 # FastAPI 백엔드 마이크로서비스
│   ├── ai_agent.py                  # Multi-LLM 에이전트, RAG 파이프라인 & 세션 메모리
│   ├── database.py                  # 비동기 SQLAlchemy 엔진 & 세션 풀 관리
│   ├── fetch_api.py                 # 국토교통부 8종 실거래 공공데이터 비동기 ETL
│   ├── lawd_cd_registry.py          # 전국 252개 LAWD_CD 마스터 딕셔너리 & 랜드마크 역색인
│   ├── main.py                      # FastAPI REST API 서버 & 캐시 미들웨어
│   ├── models.py                    # SQLAlchemy ApartmentTrade 테이블 스키마
│   └── requirements.txt             # 백엔드 Python 패키지 의존성
├── build.js                         # 프론트엔드 프로덕션 빌드 스크립트
├── package.json                     # Node.js 프로젝트 설정 및 E2E 스크립트
├── playwright.config.js             # Playwright 설정 파일
├── pytest.ini                       # Pytest 비동기 모드 설정
├── serve.js                         # 테스트 및 로컬 서빙용 경량 HTTP 정적 서버
├── TossStyleRealEstateDashboard.jsx # 토스 스타일 메인 대시보드 소스 컴포넌트
└── README.md                        # 플랫폼 종합 기술 문서
```

---

## 🚀 설치 및 로컬 실행 가이드 (Getting Started)

### 1. 레포지토리 클론
```bash
git clone https://github.com/hyeonje3402/zipview-real-estate-platform.git
cd zipview-real-estate-platform
```

### 2. 백엔드 환경 설정 및 실행
```bash
cd zipview-backend

# 가상환경 생성 및 활성화
python -m venv venv
# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

# 의존성 설치
pip install -r requirements.txt

# .env 파일 생성 후 API 키 입력 (하단 환경 변수 가이드 참조)
# 백엔드 서버 기동 (포트 8000)
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 3. 프론트엔드 빌드 및 서빙
```bash
# 프로젝트 루트 디렉토리로 이동
cd ..

# Node 의존성 설치
npm install

# 프론트엔드 프로덕션 dist 빌드
npm run build

# 정적 로컬 서버 실행 (포트 3000)
node serve.js
```
브라우저에서 `http://localhost:3000`에 접속하여 대시보드를 확인할 수 있습니다.

---

## 🔑 환경 변수 설정 (Environment Variables)

`zipview-backend/.env` 파일에 아래 환경 변수를 구성합니다:

```env
# 1. OpenAI API (AI 에이전트 자연어 파싱 및 브리핑)
OPENAI_API_KEY="sk-proj-..."

# 2. Google Gemini API (대체 LLM 엔진 선택 시)
GEMINI_API_KEY="AIzaSy..."

# 3. 국토교통부 실거래가 공공데이터포털 API Key (Decoded 일반 인증키)
MOLIT_API_KEY="..."

# 4. 데이터베이스 접속 주소 (Supabase PostgreSQL 또는 로컬 SQLite)
DATABASE_URL="postgresql+asyncpg://postgres:password@db.supabase.co:5432/postgres"

# 5. 프론트엔드 CORS 허용 Origin
CORS_ORIGINS="http://localhost:3000,http://127.0.0.1:3000,https://zip-view-rose.vercel.app"
```

---

## 📡 주요 API 명세 (API Specification)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | 서버 상태 및 DB 연결 점검 |
| `GET` | `/api/trades/{regional_code}` | 타깃 지역 3개년 누적 실거래 원장, 차트 집계, 통계 요약 (1시간 TTL 캐시 적용) |
| `POST` | `/api/chat` | AI 부동산 상담 챗봇 질의응답 (Entity Extraction, 되묻기, 세션 메모리 복원, 지역 스위칭) |
| `GET` | `/api/ai/sentiment` | 타깃 지역 실거래 기반 시장 심리 지표 분석 (관망/매수우위/매도우위) |
| `POST` | `/api/sync/region` | 관리자 및 백그라운드용 타깃 지역 국토교통부 실시간 수집 ETL 트리거 |

---

## 📄 라이선스 (License)

Copyright © 2024 ZipView Team. 본 프로젝트는 비즈니스 검증 및 상용 배포 목적으로 관리되는 독점 자산입니다.
