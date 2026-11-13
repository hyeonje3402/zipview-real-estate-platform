# 집뷰 아키텍처와 데이터 흐름

[메인 README](../../README.md)로 돌아가기

## 구성 요소

| 구성 요소 | 역할 | 구현 |
|---|---|---|
| 웹 화면 | 검색, 필터, 실거래 표·차트, 지도, AI 상담 | React 기반 프런트엔드 |
| API 서버 | 조회·집계, 동기화, 매물 API, AI 상담 요청 처리 | FastAPI, Python 3.11 |
| 거래 데이터베이스 | 공공 실거래 데이터와 조회 결과 저장 | Supabase PostgreSQL, SQLAlchemy AsyncSession, `asyncpg` |
| 공공 데이터 원천 | 지역·계약월 단위 실거래 내역 | 국토교통부 Open API (XML) |
| AI 제공자 | 자연어 조건 해석 및 결과 브리핑 | Gemini 또는 OpenAI API |
| 캐시 | 반복 조회 부담 완화 | 백엔드 인메모리 캐시 및 DB 조회 경로 |

## 운영 데이터 흐름

```text
국토교통부 Open API
        │ 지역 코드·계약 월 기준 수집
        ▼
FastAPI 수집·파싱·정규화 ──> Supabase PostgreSQL
                                  │
React 대시보드 ──> FastAPI ── 캐시 확인 ──> SQL 조건 조회·집계
      │                           │
      │                           └─ 데이터 구간 누락 시 필요한 공공 데이터 수집
      │
      └── AI 질문 ──> FastAPI ──> 자연어 조건 추출 ──> PostgreSQL 검색
                                                   └─> Gemini/OpenAI가 근거 기반 브리핑
```

AI가 반환하는 부동산 답변은 요청 조건을 분석한 뒤 DB 조회 결과를 이용해 구성합니다. 거래 조건 검색은 지역·기간·금액 등 SQL 조건을 사용합니다. **ChromaDB나 별도 Vector DB는 현재 사용하지 않습니다.**

## 데이터 종류의 구분

- **실거래 이력**: 국토교통부가 공개한 계약 완료 거래입니다. 현재 판매·임대 중인 매물 목록을 뜻하지 않습니다.
- **현재 제휴 매물**: 중개사가 제공·등록한 거래 가능 매물입니다. 백엔드에서는 `property_listing`을 별도로 관리하고 승인 상태와 만료 시각을 확인합니다.
- 실거래를 현재 매물로 변환하거나 매물 목록의 빈 공간을 과거 거래로 채우지 않습니다.

## 백엔드 주요 경로

| 파일 | 역할 |
|---|---|
| `zipview-backend/main.py` | FastAPI 앱, 거래·매물·동기화·AI API |
| `zipview-backend/database.py` | 비동기 PostgreSQL 연결 및 세션 |
| `zipview-backend/models.py` | SQLAlchemy 데이터 모델 |
| `zipview-backend/fetch_api.py` | 국토교통부 API 요청과 응답 파싱 |
| `zipview-backend/ai_agent.py` | 자연어 질의 분석, DB 검색, AI 브리핑 |
| `zipview-backend/lawd_cd_registry.py` | 지역 코드·지역명 보조 데이터 |
| `zipview-backend/supabase_indexes.sql` | 검색용 PostgreSQL 인덱스 정의 |

## 주요 API 개요

실제 요청 스키마와 응답은 실행 중인 FastAPI의 Swagger 문서(`/docs`)를 기준으로 확인하세요.

| 경로 | 용도 |
|---|---|
| `GET /` | 서비스 상태 확인 |
| `GET /api/regions`, `GET /api/region-lookup` | 지역 목록·검색 |
| `GET /api/trades/{regional_code}` | 지역 실거래 조회 |
| `GET` 또는 `POST /api/sync/{regional_code}` | 지역 데이터 동기화 요청 |
| `GET /api/sync-status` | 동기화 상태 확인 |
| `GET /api/listings` | 승인된 현재 매물 목록 |
| `POST /api/chat`, `POST /api/ai/briefing` | DB 근거 기반 AI 상담 |

매물 검수 API는 `/api/admin/listings` 경로를 사용하며 관리자 키 설정이 필요합니다. 구체적인 인증·필드 조건은 [운영 문서](../operations/README.md)를 참고하세요.
