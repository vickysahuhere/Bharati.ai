from datetime import datetime, timedelta, timezone
import jwt
import bcrypt
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from typing import Optional

from app.core.config import get_settings
from app.core.bot_protection import (
    auth_login_rate_limiter,
    auth_signup_rate_limiter,
    verify_honeypot,
)
from app.db.session import pool

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="api/auth/login", auto_error=False)

router = APIRouter(prefix="/api/auth", tags=["auth"])

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, get_settings().secret_key, algorithm=get_settings().jwt_algorithm)
    return encoded_jwt

class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    status: str

class SignupRequest(BaseModel):
    email: str
    password: str
    full_name: str
    hp_field: Optional[str] = None  # Honeypot field for bot trapping

@router.post("/signup", response_model=UserResponse)
def signup(request: SignupRequest, req: Request):
    # 1. Anti-bot honeypot check
    verify_honeypot(request.hp_field)

    # 2. Rate limiting (max 3 signups per 5 mins per IP)
    auth_signup_rate_limiter.check(req)

    # 3. Input validation against payload tampering
    clean_email = request.email.strip().lower()
    clean_name = request.full_name.strip()
    if not clean_email or len(clean_email) > 120 or "@" not in clean_email or "." not in clean_email:
        raise HTTPException(status_code=400, detail="Invalid email address format")
    if not clean_name or len(clean_name) > 100:
        raise HTTPException(status_code=400, detail="Name must be between 1 and 100 characters")
    if len(request.password) < 6 or len(request.password) > 128:
        raise HTTPException(status_code=400, detail="Password must be between 6 and 128 characters")

    settings = get_settings()
    hashed_password = get_password_hash(request.password)
    # The first user registered with OWNER_EMAIL gets 'admin' role and 'approved' status
    is_owner = clean_email == settings.owner_email.lower()
    role = 'admin' if is_owner else 'student'
    user_status = 'approved' if is_owner else 'pending'
    
    with pool().connection() as conn:
        row = conn.execute(
            """
            INSERT INTO users (email, password_hash, full_name, role, status)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (email) DO NOTHING
            RETURNING id, email, full_name, role, status
            """,
            (clean_email, hashed_password, clean_name, role, user_status)
        ).fetchone()
        
        if not row:
            raise HTTPException(status_code=400, detail="Email already registered")
            
        return UserResponse(
            id=str(row[0]), email=row[1], full_name=row[2], role=row[3], status=row[4]
        )

@router.post("/login")
def login(req: Request, form_data: OAuth2PasswordRequestForm = Depends()):
    # Anti-brute-force rate limiting: max 5 login attempts per min per IP
    auth_login_rate_limiter.check(req)

    with pool().connection() as conn:
        row = conn.execute(
            "SELECT id, email, password_hash, role, status FROM users WHERE email = %s", 
            (form_data.username.lower(),)
        ).fetchone()
        
    if not row or not verify_password(form_data.password, row[2]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if row[4] != 'approved':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Account is {row[4]}",
        )
        
    access_token_expires = timedelta(minutes=get_settings().access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": row[1], "id": str(row[0]), "role": row[3]}, 
        expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, get_settings().secret_key, algorithms=[get_settings().jwt_algorithm])
        user_id: str = payload.get("id")
        if user_id is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception
        
    with pool().connection() as conn:
        row = conn.execute(
            "SELECT id, email, full_name, role, status FROM users WHERE id = %s", 
            (user_id,)
        ).fetchone()
        
    if row is None:
        raise credentials_exception
        
    return UserResponse(
        id=str(row[0]), email=row[1], full_name=row[2], role=row[3], status=row[4]
    )

def get_optional_user(token: Optional[str] = Depends(oauth2_scheme_optional)) -> Optional[UserResponse]:
    if not token:
        return None
    try:
        payload = jwt.decode(token, get_settings().secret_key, algorithms=[get_settings().jwt_algorithm])
        user_id: str = payload.get("id")
        if user_id is None:
            return None
        with pool().connection() as conn:
            row = conn.execute(
                "SELECT id, email, full_name, role, status FROM users WHERE id = %s", 
                (user_id,)
            ).fetchone()
            if not row or row[4] != 'approved':
                return None
            return UserResponse(
                id=str(row[0]), email=row[1], full_name=row[2], role=row[3], status=row[4]
            )
    except Exception:
        return None

def get_admin_user(current_user: UserResponse = Depends(get_current_user)):
    if current_user.role != 'admin':
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")
    return current_user
