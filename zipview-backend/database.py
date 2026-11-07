import os
from dotenv import load_dotenv  # 추가: dotenv 패키지 불러오기
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.ext.declarative import declarative_base

load_dotenv()  # 추가: .env 파일의 내용을 파이썬 시스템에 적용

# 1. Supabase / PostgreSQL 비동기 접속 URL 설정
DB_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:5432/postgres"
)
# 2. 비동기 엔진 생성 (연결 풀 고갈 방지 및 타임아웃 방어)
engine = create_async_engine(
    DB_URL,
    echo=False,
    future=True,
    pool_pre_ping=True,
    pool_size=15,
    max_overflow=20,
    pool_timeout=30,
    pool_recycle=1800
)

# 3. 비동기 세션 팩토리 생성
SessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False
)

Base = declarative_base()

# 4. FastAPI 의존성 주입용 비동기 DB 세션 제너레이터
async def get_db():
    db: AsyncSession = SessionLocal()
    try:
        yield db
    finally:
        await db.close()