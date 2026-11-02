import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# SQLite 기본 파일 경로 (필요 시 PostgreSQL URI로 변경 가능)
# 예: postgresql://user:password@localhost:5432/realestate
DB_URL = os.getenv("DATABASE_URL", "sqlite:///./real_estate.db")

# SQLite 사용 시 스레드 체크 옵션 추가
connect_args = {"check_same_thread": False} if DB_URL.startswith("sqlite") else {}

engine = create_engine(DB_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    """FastAPI 및 단독 스크립트용 DB 세션 제너레이터"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

