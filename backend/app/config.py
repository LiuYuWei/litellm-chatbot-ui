"""應用設定：所有組態皆可由環境變數覆寫。"""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # --- LiteLLM ---
    litellm_base_url: str = "http://localhost:4000"
    litellm_api_key: str = ""
    litellm_timeout: float = 120.0

    # --- 模型 ---
    default_model: str = "gpt-4o-mini"
    # 以逗號分隔的白名單；留空代表直接採用 LiteLLM /v1/models 回傳的清單
    allowed_models: str = ""

    # --- 登入驗證（環境變數固定帳密）---
    # 格式：user1:password1,user2:password2
    auth_users: str = "admin:admin1234"
    jwt_secret: str = "please-change-this-secret-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 720

    # --- 伺服器 ---
    app_name: str = "LiteLLM Chatbot UI"
    cors_origins: str = "*"
    static_dir: str = "static"
    log_level: str = "info"

    @property
    def users(self) -> dict[str, str]:
        """解析 AUTH_USERS 成 {帳號: 密碼} 字典。"""
        result: dict[str, str] = {}
        for entry in self.auth_users.split(","):
            entry = entry.strip()
            if not entry or ":" not in entry:
                continue
            username, password = entry.split(":", 1)
            username, password = username.strip(), password.strip()
            if username and password:
                result[username] = password
        return result

    @property
    def model_allowlist(self) -> list[str]:
        return [m.strip() for m in self.allowed_models.split(",") if m.strip()]

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()] or ["*"]

    @property
    def litellm_url(self) -> str:
        return self.litellm_base_url.rstrip("/")


@lru_cache
def get_settings() -> Settings:
    return Settings()
