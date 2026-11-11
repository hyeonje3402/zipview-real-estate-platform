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

`.env`에는 실제 인증 정보를 입력하고 Git에 커밋하지 마세요.
