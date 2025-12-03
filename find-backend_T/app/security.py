# app/security.py

from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext
from jose import JWTError, jwt
from app.config import JWT_SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES
from app.schemas import TokenData



# --- 1. 비밀번호 해싱 설정 ---
# "bcrypt_sha256"을 사용하여 72바이트 제한 문제를 회피합니다.
pwd_context = CryptContext(schemes=["bcrypt_sha256"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """입력된 비밀번호(plain)와 DB의 해시된 비밀번호(hashed)를 비교합니다."""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """비밀번호를 bcrypt 해시값으로 변환합니다."""
    return pwd_context.hash(password)

# --- 2. JWT 토큰 생성 및 검증 ---
def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """JWT 액세스 토큰을 생성합니다."""
    to_encode = data.copy()
    
    # 만료 시간 설정
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        # 기본 만료 시간 (예: 30분)
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        
    to_encode.update({"exp": expire})
    
    # JWT 토큰 생성
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(token: str, credentials_exception) -> TokenData:
    """JWT 토큰을 검증하고, 유저 이름을 반환합니다."""
    try:
        # 토큰 해독
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[ALGORITHM])
        username: str | None = payload.get("sub") # 토큰 생성 시 'sub' 키에 유저 이름을 넣을 예정
        
        if username is None:
            raise credentials_exception # 유저 이름이 없음
        
        return TokenData(username=username) # 유효한 토큰
    
    except JWTError:
        raise credentials_exception # 토큰이 유효하지 않음