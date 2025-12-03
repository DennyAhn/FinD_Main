# app/database.py

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# 1. 로컬 MySQL DB 접속 정보 (fin_agent DB 기준)
# (주의: root와 password는 본인의 MySQL Workbench 설정과 동일해야 합니다)
# auth_plugin 파라미터 추가: caching_sha2_password 인증 방식 지원
SQLALCHEMY_DATABASE_URL = "mysql+pymysql://root:Aa5051140!@localhost:3307/fin_agent?charset=utf8mb4"

# 2. DB 연결 엔진 생성 (연결 풀 설정 포함)
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    pool_pre_ping=True,  # 연결이 살아있는지 확인 후 사용
    pool_recycle=3600,   # 1시간마다 연결 재생성
    echo=False           # SQL 쿼리 로깅 (디버깅 시 True로 변경)
)

# 3. DB와 통신할 세션 생성
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 4. SQLAlchemy 모델들이 상속할 기본 클래스
Base = declarative_base()