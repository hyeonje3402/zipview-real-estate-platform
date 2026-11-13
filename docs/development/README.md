# 개발 환경과 API

[메인 README](../../README.md)로 돌아가기

## 준비물

- Node.js 18 이상
- Python 3.11 권장
- PostgreSQL 데이터베이스 (Supabase 사용 가능)
- 사용할 AI 제공자 키 (Gemini 또는 OpenAI), 국토교통부 API 키

## 환경 변수

프로젝트 루트에 `.env` 파일을 만들고 실제 값을 설정합니다. `.env`는 Git에 커밋하지 않습니다.

```powershell
Copy-Item .env.example .env
```

```env
DATABASE_URL=postgresql+asyncpg://사용자:비밀번호@호스트:포트/데이터베이스
MOLIT_API_KEY=공공데이터포털_인증키
GEMINI_API_KEY=Gemini_API_키
OPENAI_API_KEY=선택_OpenAI_API_키
```

필요한 국토부 엔드포인트는 `.env.example`의 `MOLIT_ENDPOINT_*` 예시를 확인합니다. DB 비밀번호나 API 키가 포함된 연결 문자열을 채팅, 스크린샷, 저장소에 노출하지 마세요.

## 로컬 실행

### 백엔드

```powershell
cd zipview-backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8001
```

백엔드 상태는 `http://127.0.0.1:8001/`, API 문서는 `http://127.0.0.1:8001/docs`에서 확인합니다.

### 프런트엔드

프로젝트 루트의 새 터미널에서:

```powershell
npm install
npm run build
node serve.js
```

`serve.js`는 기본 포트를 사용합니다. 이미 사용 중이면 터미널에서 `PORT=3030` 같은 포트를 지정해 실행하거나 해당 실행 스크립트를 참고하세요. 백엔드와 프런트엔드는 별도 프로세스이므로 각 터미널을 켜 둬야 로컬에서 계속 접속할 수 있습니다.

## 테스트와 빌드

```powershell
# 백엔드 테스트
python -m pytest

# 프런트엔드 번들 빌드
npm run build

# 브라우저 E2E
npm run test:e2e
```

## 프런트엔드 주요 파일

| 파일 | 역할 |
|---|---|
| `TossStyleRealEstateDashboard.jsx` | 대시보드 화면 |
| `GeminiChatModal.jsx` | AI 상담 UI |
| `build.js`, `serve.js` | 프런트엔드 빌드와 로컬 정적 서버 |

## 로컬 개발 문제 해결

- `ERR_CONNECTION_REFUSED`: 대상 포트에서 서버가 실행 중인지, 프런트엔드와 백엔드 주소·포트가 맞는지 확인합니다.
- `EADDRINUSE`: 같은 포트를 다른 프로세스가 사용 중입니다. 실행 중인 기존 서버를 재사용하거나 다른 포트로 실행합니다.
- DB 연결 오류: `DATABASE_URL`의 드라이버가 `postgresql+asyncpg://`인지, 비밀번호에 URL 예약 문자가 있으면 인코딩했는지 확인합니다.
- AI 상담의 규칙 기반 응답: 선택한 제공자 API 키·사용량·백엔드 로그를 확인합니다. 유료 API의 사용량은 ChatGPT Plus/Pro 구독과 별도로 청구될 수 있습니다.
