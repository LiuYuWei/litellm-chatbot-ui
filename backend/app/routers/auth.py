"""登入相關端點。"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from ..auth import authenticate_user, create_access_token, get_current_user
from ..config import Settings, get_settings
from ..schemas import LoginRequest, LoginResponse, UserInfo

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
async def login(
    payload: LoginRequest, settings: Settings = Depends(get_settings)
) -> LoginResponse:
    if not authenticate_user(payload.username, payload.password, settings):
        logger.info("登入失敗：%s", payload.username)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="帳號或密碼錯誤。",
        )
    token, expires_in = create_access_token(payload.username, settings)
    logger.info("登入成功：%s", payload.username)
    return LoginResponse(
        access_token=token, expires_in=expires_in, username=payload.username
    )


@router.get("/me", response_model=UserInfo)
async def me(username: str = Depends(get_current_user)) -> UserInfo:
    """給前端啟動時確認 token 是否仍有效。"""
    return UserInfo(username=username)
