from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer # 로그인 폼
from sqlalchemy.orm import Session
from datetime import timedelta

from app import models, schemas, security
from app.database import SessionLocal, engine

# --- [추가 1] ---
# "/api/v1/auth/login" 주소에서 토큰을 받아오라고 알려주는 설정
# 이것이 "신분증(JWT 토큰)을 헤더에서 찾아라"는 명령입니다.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")
# --- [추가 1 완료] ---

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

router = APIRouter(
    prefix="/api/v1/auth",
    tags=["Authentication"]
)

@router.post("/signup", response_model=schemas.User)
def create_user(
    user: schemas.UserCreate, 
    db: Session = Depends(get_db)
):

    db_user = db.query(models.User).filter(models.User.username == user.username).first()
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 존재하는 아이디입니다."
        )
    hashed_password = security.get_password_hash(user.password)

    db_user = models.User(
        username=user.username,
        hashed_password=hashed_password,
        name=user.name,
        age=user.age,
        email=user.email
    )
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

#--- 로그인 API 엔드포인트 ---
@router.post("/login", response_model=schemas.Token)
def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
): 

# 1. 유저 확인
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    
    # 2. 유저가 없거나, 비밀번호가 틀리면 에러
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="아이디 또는 비밀번호가 정확하지 않습니다.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 3. 유저가 맞으면 JWT 토큰 생성 (security.py 사용)
    access_token = security.create_access_token(
        data={"sub": user.username} # 토큰의 주체(subject)는 유저 이름
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

# "신분증 검사관" 함수 (가장 중요)
def get_current_user(
    token: str = Depends(oauth2_scheme), # 1. 헤더에서 토큰을 추출
    db: Session = Depends(get_db)         # 2. DB 세션을 준비
) -> models.User:
    """
    토큰을 검증하고, 유효하면 DB에서 해당 유저 정보를 반환합니다.
    이 함수를 Depends()로 사용하는 모든 API는 '로그인 필수'가 됩니다.
    """
    
    # 3. 토큰이 유효하지 않으면 401 에러 발생
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    # 4. security.py의 함수로 토큰 검증
    token_data = security.verify_token(token, credentials_exception)
    
    # 5. 토큰에서 유저 이름을 꺼내 DB에서 실제 유저 조회
    user = db.query(models.User).filter(models.User.username == token_data.username).first()
    
    # 6. 유저가 DB에 없으면 에러
    if user is None:
        raise credentials_exception
        
    # 7. 유효한 유저 정보를 반환
    return user