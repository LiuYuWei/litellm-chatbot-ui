"""API 請求／回應的資料結構定義。"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=64)
    password: str = Field(..., min_length=1, max_length=256)


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    username: str


class UserInfo(BaseModel):
    username: str


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(..., min_length=1)
    model: str | None = None
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: int | None = Field(default=None, ge=1, le=32768)
    stream: bool = True


class ModelInfo(BaseModel):
    id: str
    owned_by: str | None = None


class ModelListResponse(BaseModel):
    models: list[ModelInfo]
    default_model: str


class HealthResponse(BaseModel):
    status: str
    app: str
    litellm_base_url: str
    litellm_reachable: bool | None = None
