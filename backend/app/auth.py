"""登入驗證：以環境變數設定的固定帳密搭配 JWT。"""

from __future__ import annotations

import hmac
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import Settings, get_settings

bearer_scheme = HTTPBearer(auto_error=False)


def authenticate_user(username: str, password: str, settings: Settings) -> bool:
    """以固定時間比對避免時序攻擊。"""
    expected = settings.users.get(username)
    if expected is None:
        # 即使帳號不存在也做一次比對，讓回應時間一致。
        hmac.compare_digest(password, password)
        return False
    return hmac.compare_digest(password, expected)


def create_access_token(username: str, settings: Settings) -> tuple[str, int]:
    """回傳 (token, 有效秒數)。"""
    expires_in = settings.jwt_expire_minutes * 60
    now = datetime.now(timezone.utc)
    payload = {
        "sub": username,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=expires_in)).timestamp()),
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return token, expires_in


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    settings: Settings = Depends(get_settings),
) -> str:
    """FastAPI 相依項：驗證 Bearer token 並回傳使用者名稱。"""
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="登入憑證無效或已過期，請重新登入。",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None or not credentials.credentials:
        raise unauthorized
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
    except jwt.PyJWTError as exc:  # 過期、簽章錯誤等
        raise unauthorized from exc

    username = payload.get("sub")
    if not username or username not in settings.users:
        raise unauthorized
    return username
