# 운영·CI/CD·배포

[메인 README](../../README.md)로 돌아가기

## 운영 구성

| 역할 | 서비스 | 설정 파일/위치 |
|---|---|---|
| 소스 관리 | GitHub | 저장소의 `main` 브랜치 |
| CI | GitHub Actions | `.github/workflows/test.yml` |
| 프런트엔드 호스팅 | Vercel | `vercel.json`, Vercel 프로젝트 설정 |
| 백엔드 호스팅 | Render | `render.yaml`, Render 서비스 설정 |
| PostgreSQL | Supabase | `DATABASE_URL`, `supabase_indexes.sql` |
| 공공 데이터 | 국토교통부 Open API | `MOLIT_API_KEY`, 엔드포인트 환경 변수 |
| AI | Gemini / OpenAI | `GEMINI_API_KEY`, 선택적 `OPENAI_API_KEY` |

## CI 파이프라인

`.github/workflows/test.yml`은 `main` 브랜치로 push하거나 `main` 대상 Pull Request가 열릴 때 실행됩니다.

1. **Backend tests**: Python 3.11 설정 후 `pytest tests/api/test_routes.py -v --tb=short` 실행
2. **Frontend build and E2E**: Node.js 20, npm 의존성 설치, Playwright Chromium 설치, `npm run build`, `npm run test:e2e` 실행

GitHub Actions는 테스트와 빌드 검증을 담당합니다. 이 workflow 안에 Vercel/Render 배포 명령은 없습니다.

## CD와 운영 데이터

프런트엔드 배포 빌드 설정은 `vercel.json`에, 백엔드 서비스 빌드·실행·상태 확인 설정은 `render.yaml`에 있습니다. GitHub 저장소를 각 호스팅 서비스와 연결하고 자동 배포를 켜면 저장소 변경을 배포할 수 있습니다. **연동·배포 성공 여부는 Vercel과 Render 대시보드에서 확인해야 합니다.**

데이터 흐름과 DB 역할은 [아키텍처 문서](../architecture/README.md)를 참고하세요. PostgreSQL은 거래 조회 및 현재 매물 데이터 저장에 사용되고, AI 상담은 SQL 조회 결과를 답변 근거로 삼습니다.

## 서비스별 설정

### Vercel

- Git 저장소를 연결합니다.
- Root Directory는 저장소 루트로 설정합니다.
- Build Command: `npm run build`
- Output Directory: `dist`
- `vercel.json`에 SPA 경로 재작성 설정이 있습니다.
- 백엔드 API 주소 관련 환경 변수는 현재 프런트엔드 코드와 프로젝트 환경 설정에 맞게 지정하고 Preview/Production 환경을 각각 확인합니다.

### Render

- Blueprint 방식이면 `render.yaml`을 사용합니다. 서비스 Root Directory는 `zipview-backend`입니다.
- 빌드 명령: `pip install -r requirements.txt`
- 시작 명령: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- 상태 확인 경로: `/`
- 필수 비밀 환경 변수: `DATABASE_URL`, `MOLIT_API_KEY`, `GEMINI_API_KEY`
- `LISTING_ADMIN_API_KEY`는 검수용 매물 등록·상태 변경 API를 사용할 때 설정합니다.
- `ALLOWED_ORIGINS`에는 실제 Vercel 도메인을 넣습니다.

`DATABASE_URL`은 SQLAlchemy async 드라이버에서 사용하는 `postgresql+asyncpg://` URI 형식입니다. Supabase pooler를 사용하는 경우 프로젝트의 네트워크·배포 환경에 맞는 연결 모드와 포트를 대시보드에서 확인하세요. 비밀번호가 포함된 URI는 Git이나 공개 문서에 넣지 않습니다.

### Supabase

- PostgreSQL 연결 문자열을 Render의 `DATABASE_URL`에 비밀 환경 변수로 등록합니다.
- 검색 인덱스 정의는 `zipview-backend/supabase_indexes.sql`에 있습니다.
- 로컬 `.env`와 호스팅 환경 변수는 별도로 관리합니다. 로컬 `.env`가 배포 서비스로 자동 전달되지 않습니다.

## 배포 확인 순서

1. PR 또는 push 후 GitHub Actions의 backend/frontend 작업이 성공했는지 확인합니다.
2. Vercel에서 최신 커밋 배포 상태와 프런트엔드 페이지를 확인합니다.
3. Render에서 최신 커밋 배포와 `/` 상태 확인을 살펴봅니다.
4. 프런트엔드가 올바른 백엔드 주소를 사용하고 CORS `ALLOWED_ORIGINS`에 배포 도메인이 있는지 확인합니다.
5. 실제 거래 조회, 매물 API, AI 상담을 각각 점검하고 호스팅 로그를 확인합니다.

무료 Render 인스턴스는 비활성 상태 이후 절전되어 첫 요청이 지연될 수 있습니다. 호스팅 도메인과 자동 배포가 실제로 동작하는지는 서비스 대시보드에서 확인해야 합니다.
