# 집뷰 (ZipView)

국토교통부 실거래 데이터를 바탕으로 지역별 시세를 살펴보고, AI 상담과 단지 비교를 제공하는 부동산 대시보드입니다.

## 한눈에 보기

- **대시보드:** 지역 검색, 실거래 추이 차트, 단지 비교, 지도 보기
- **AI 상담:** 자연어로 지역·거래 조건을 질문하고 매물 정보를 탐색
- **데이터:** 국토교통부 실거래가를 수집해 PostgreSQL/Supabase에 저장
- **구성:** React 프론트엔드 + FastAPI 백엔드

## 실행 방법

Node.js 18 이상과 Python이 필요합니다. API 키와 데이터베이스 주소는 프로젝트 루트의 `.env` 파일에 설정합니다.

### 1. 환경 변수 준비

```powershell
Copy-Item .env.example .env
```

`.env`에 다음 값을 입력합니다.

```env
OPENAI_API_KEY=...
GEMINI_API_KEY=...
MOLIT_API_KEY=...
DATABASE_URL=postgresql+asyncpg://사용자:비밀번호@호스트:5432/데이터베이스
```

사용할 AI 제공자의 키와 국토교통부 API 키가 필요합니다. 데이터베이스는 PostgreSQL을 사용하며 Supabase 연결 주소를 지정할 수 있습니다.

### 2. 백엔드 실행

별도 터미널에서:

```powershell
cd zipview-backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8001
```

### 3. 프론트엔드 실행

프로젝트 루트에서 별도 터미널로:

```powershell
npm install
npm run build
node serve.js
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 엽니다. 대시보드의 실거래·AI 기능을 사용하려면 백엔드도 실행 중이어야 합니다.

## 주요 경로

| 경로 | 내용 |
| --- | --- |
| `TossStyleRealEstateDashboard.jsx` | 대시보드 화면 |
| `GeminiChatModal.jsx` | AI 상담 UI |
| `build.js`, `serve.js` | 프론트엔드 빌드와 로컬 정적 서버 |
| `zipview-backend/main.py` | FastAPI 엔드포인트 |
| `zipview-backend/ai_agent.py` | AI 상담 및 매물 검색 |
| `zipview-backend/fetch_api.py` | 국토교통부 데이터 수집 |
| `zipview-backend/lawd_cd_registry.py` | 지역 코드 및 지역명 검색 |

## 테스트

```powershell
python -m pytest
npm run test:e2e
```

## 운영 데이터 흐름

```text
브라우저 대시보드
  ├─ 지역·거래 조회 ──> FastAPI ──> 캐시 ──> Supabase PostgreSQL
  │                                  └─ 누락 데이터 ──> 국토교통부 Open API
  └─ AI 상담 ─────────> FastAPI ──> OpenAI 또는 Gemini
```

FastAPI는 실거래 조회 시 캐시와 PostgreSQL을 확인하고, 필요한 경우 국토교통부 API에서 데이터를 수집합니다. 데이터베이스 연결은 비동기 SQLAlchemy와 `asyncpg`를 사용합니다. 검색 성능용 PostgreSQL 인덱스는 `zipview-backend/supabase_indexes.sql`에 있습니다.

## CI/CD 및 클라우드

| 구분 | 사용 기술 | 저장소에서 확인되는 설정 |
| --- | --- | --- |
| CI | GitHub Actions | `main` 대상 push/PR 때 백엔드 Pytest와 프론트엔드 빌드·Playwright E2E 실행 |
| 프론트엔드 빌드 | Node.js, Vercel | `vercel.json`이 `npm run build`와 `dist`를 지정하고 SPA 경로 재작성을 설정 |
| 프론트엔드 배포 | Vercel | `vercel.json`에 빌드·정적 파일 설정 포함. Git 연동 자동 배포 여부는 Vercel 프로젝트 설정에서 확인 |
| 백엔드 호스팅 | Render | `render.yaml`에 무료 웹 서비스 빌드·실행·상태 확인 설정 포함 |
| 데이터베이스 | Supabase PostgreSQL | 비동기 PostgreSQL 연결 및 Supabase 인덱스 SQL 사용 |
| 외부 데이터·AI | 국토교통부 Open API, OpenAI, Gemini | 키는 환경 변수로 관리 |

CI 워크플로는 `.github/workflows/test.yml`입니다. GitHub Actions는 테스트와 빌드를 수행합니다. 배포는 Vercel과 Render가 저장소 변경을 감지하는 자동 배포를 사용하도록 각 서비스에서 저장소를 한 번 연결해야 합니다. 실제 서비스 환경 변수는 서비스 대시보드에서 설정하며 Git에 올리지 않습니다.

### 무료 도메인으로 배포하기

현재 프런트엔드 주소는 `https://zip-view-rose.vercel.app`, 백엔드 주소는 `https://zipview-real-estate-platform.onrender.com`을 기준으로 설정되어 있습니다. 두 주소는 호스팅 제공자가 프로젝트에 연결해 준 기본 도메인이며, 별도 도메인을 구매하지 않아도 사용할 수 있습니다.

1. GitHub에서 이 저장소를 Vercel에 연결하고 Root Directory를 저장소 루트, Build Command를 `npm run build`, Output Directory를 `dist`로 설정합니다. 설정은 `vercel.json`에도 포함되어 있습니다.
2. Render에서 저장소의 `render.yaml`로 Blueprint를 생성합니다. Render 웹 서비스의 Root Directory는 `zipview-backend`입니다.
3. Render 환경 변수에 `DATABASE_URL`, `MOLIT_API_KEY`, `GEMINI_API_KEY`를 등록합니다. `DATABASE_URL`은 Supabase Session Pooler URI를 `postgresql+asyncpg://` 형식으로 맞춥니다. AI 상담은 Gemini 3.8 Flash를 기본으로 사용하며, OpenAI는 선택 시 별도 API 사용료가 생길 수 있습니다.
4. Render의 `ALLOWED_ORIGINS`에 프런트엔드 도메인을 등록합니다. 현재 기본값은 Vercel 도메인입니다. 별도 도메인을 연결할 경우 `https://`를 포함한 전체 주소를 여기에 추가합니다.
5. 각 서비스의 자동 배포가 켜져 있는지 확인하고, 배포 후 `https://zipview-real-estate-platform.onrender.com/`에서 백엔드 상태를 확인합니다. 첫 요청은 무료 Render 인스턴스가 깨어나느라 지연될 수 있습니다.

Vercel과 Render 계정의 저장소 연결 및 비밀 환경 변수 등록은 대시보드에서 한 번 완료해야 합니다. `.env`는 로컬 개발용이며 배포 환경으로 자동 전송되지 않습니다. Supabase 비밀번호나 API 키를 GitHub에 커밋하지 마세요.

### 코드 변경부터 서비스 반영까지

1. 브랜치에 변경사항을 push하거나 `main` 대상으로 PR을 엽니다.
2. GitHub Actions에서 API 테스트, 프론트엔드 빌드, 브라우저 E2E 테스트를 실행합니다.
3. 프론트엔드는 Vercel 프로젝트의 Git 연동 설정에 따라 배포됩니다. 백엔드는 Render 서비스의 배포 설정에 따라 배포됩니다.
4. 프론트엔드와 백엔드가 같은 환경의 API 주소·환경 변수를 사용하고 있는지 확인합니다.

> 3번의 자동 배포는 Vercel/Render 프로젝트 설정에 달려 있습니다. 이 저장소의 CI 파일만으로 배포 성공이나 자동 배포 연결을 보장하지는 않습니다.

## 릴리스 계획

현재 저장소에는 `v0.2.0` 릴리스 태그가 없으므로 아래 내용은 **다음 마일스톤 제안**입니다. 현재 `package.json`의 버전은 `1.0.0`이며, 실제 릴리스 전에 제품 버전 표기와 함께 정리해야 합니다.

### v0.2.0 — 데이터 운영과 검색 경험 개선 (예정)

- **수집 상태를 화면에서 확인:** 지역·기간별 마지막 동기화 시각, 성공/실패 상태를 표시하고 실패한 기간을 다시 요청할 수 있게 합니다.
- **검색 결과 탐색 개선:** 거래 유형·기간·가격 조건을 결과와 동기화하고, 로딩·빈 결과·API 오류 상태를 구분해 보여줍니다.
- **운영 안정성 보강:** 백엔드 상태 확인(health/readiness)과 주요 오류 로그를 정리하고, CI에 배포 전 API 상태 확인 단계를 추가합니다.

**완료 기준:** 수집 실패를 사용자가 알아볼 수 있고 재시도할 수 있을 것, 검색 조건이 URL과 결과에 일관되게 반영될 것, CI에서 백엔드 테스트·프론트엔드 E2E·배포 전 상태 확인이 모두 통과할 것.

`.env`에는 실제 인증 정보를 입력하고 Git에 커밋하지 마세요.
