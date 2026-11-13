# 집뷰 (ZipView)

국토교통부 실거래 데이터를 지역별로 살펴보고, PostgreSQL 기반 검색과 AI 상담으로 부동산 의사결정을 돕는 웹 대시보드입니다.

## 프로젝트 개요

| 항목 | 내용 |
|---|---|
| 주요 기능 | 지역별 실거래 조회·집계, 단지 비교, 지도, 자연어 AI 상담, 제휴 매물 관리 API |
| Frontend | React, JavaScript, CSS, Playwright |
| Backend | Python 3.11, FastAPI, SQLAlchemy 비동기 API |
| Database | Supabase PostgreSQL (`asyncpg`) |
| AI | Google Gemini, OpenAI API 선택 연동 |
| 데이터 | 국토교통부 실거래가 Open API |
| CI | GitHub Actions (Pytest, 프런트엔드 빌드, Playwright E2E) |
| 배포 구성 | Vercel (Frontend), Render (Backend) |

## 전체 아키텍처

```text
국토교통부 Open API ──> FastAPI 데이터 수집·정규화 ──> Supabase PostgreSQL
                                                       │
React 대시보드 ──> FastAPI ── 캐시·SQL 조회 ───────────┤
       └─────────> AI 상담 ── 조건 추출·DB 검색 ────────┴─> Gemini / OpenAI 브리핑

GitHub Actions: 테스트·빌드 검증
Vercel: React 정적 웹 배포      Render: FastAPI 서비스 배포
```

AI 상담은 자연어에서 지역·거래 조건을 추출하고 실거래 DB를 검색해 근거를 구성합니다. 별도 Vector DB는 사용하지 않으며, 지역·가격·거래 유형 조건을 PostgreSQL SQL로 조회합니다. 실거래 이력과 중개사가 등록하는 현재 매물은 별도 데이터로 관리합니다.

## 문서

- [아키텍처와 데이터 흐름](docs/architecture/README.md) — 구성 요소, 요청 흐름, 실거래와 현재 매물의 구분
- [개발 환경과 API](docs/development/README.md) — 로컬 실행, 환경 변수, 주요 API, 테스트 방법
- [운영·CI/CD·배포](docs/operations/README.md) — GitHub Actions, Vercel, Render, Supabase 설정과 배포 흐름
- [로드맵과 버전 계획](docs/roadmap/README.md) — 현재 단계와 다음 마일스톤 제안

## 빠른 시작

실행 전제 조건과 환경 변수 설정은 [개발 문서](docs/development/README.md)를 참고하세요. 로컬 개발은 백엔드와 프런트엔드를 각각 실행해야 합니다.

```powershell
# 터미널 1: 백엔드
cd zipview-backend
python -m uvicorn main:app --reload --port 8001

# 터미널 2: 프로젝트 루트에서 프런트엔드 빌드·정적 서버
npm install
npm run build
node serve.js
```

## 현재 상태

프로젝트는 개발·배포 준비 단계입니다. 실제 매물은 실거래 이력과 분리된 제휴 매물 데이터로만 제공하도록 구성하고 있으며, 중개사용 로그인·등록 화면과 운영 배포 환경 검증은 후속 작업입니다. 상세 범위와 제한 사항은 [로드맵](docs/roadmap/README.md)에서 확인할 수 있습니다.

> 배포 주소, 자동 배포 여부, 서비스 환경 변수의 정상 동작은 각 호스팅 대시보드에서 확인해야 합니다. 저장소의 설정 파일만으로 실제 배포 성공을 보장하지 않습니다.
