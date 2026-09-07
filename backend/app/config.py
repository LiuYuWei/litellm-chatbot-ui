"""應用設定：所有組態皆可由環境變數覆寫。"""

from __future__ import annotations

import json
import re
from functools import cached_property, lru_cache

from pydantic import BaseModel, Field, ValidationInfo, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# 來源 id 用於組成「來源/模型」的合格模型名稱，因此不允許斜線與空白。
PROVIDER_ID_PATTERN = re.compile(r"^[A-Za-z0-9._-]+$")

TEMPERATURE_MIN, TEMPERATURE_MAX = 0.0, 2.0


def _check_temperature(value: float, where: str) -> float:
    if not TEMPERATURE_MIN <= value <= TEMPERATURE_MAX:
        raise ValueError(
            f"{where} 的 temperature {value} 超出範圍，必須介於 "
            f"{TEMPERATURE_MIN} 與 {TEMPERATURE_MAX} 之間。"
        )
    return value


class ProviderConfig(BaseModel):
    """一個 OpenAI 相容的模型來源（LiteLLM Proxy、vLLM、Ollama…皆適用）。"""

    id: str
    label: str = ""
    base_url: str
    api_key: str = ""
    timeout: float = 120.0
    # 此來源的模型白名單；留空代表採用該來源 /v1/models 回傳的全部模型。
    allowed_models: list[str] = Field(default_factory=list)
    # 此來源的預設 temperature；留空則採用全域 DEFAULT_TEMPERATURE。
    default_temperature: float | None = None
    # 針對個別模型覆寫 temperature，鍵為該來源上的「原生」模型名稱（不含來源前綴）。
    model_temperatures: dict[str, float] = Field(default_factory=dict)

    @field_validator("id")
    @classmethod
    def _validate_id(cls, value: str) -> str:
        value = value.strip()
        if not PROVIDER_ID_PATTERN.match(value):
            raise ValueError(
                f"來源 id「{value}」只能包含英數字、底線、句點與連字號（不可有斜線或空白）。"
            )
        return value

    @field_validator("base_url")
    @classmethod
    def _validate_base_url(cls, value: str) -> str:
        value = value.strip().rstrip("/")
        if not value:
            raise ValueError("來源的 base_url 不可為空。")
        return value

    @field_validator("default_temperature")
    @classmethod
    def _validate_default_temperature(cls, value: float | None) -> float | None:
        return None if value is None else _check_temperature(value, "來源")

    @field_validator("model_temperatures")
    @classmethod
    def _validate_model_temperatures(cls, value: dict[str, float]) -> dict[str, float]:
        return {k: _check_temperature(v, f"模型「{k}」") for k, v in value.items()}

    def model_post_init(self, __context: object) -> None:
        if not self.label:
            self.label = self.id

    def temperature_for(self, model_id: str, fallback: float) -> float:
        """決定某個模型該用的 temperature：模型層級 > 來源層級 > 全域預設。"""
        override = self.model_temperatures.get(model_id)
        if override is not None:
            return override
        if self.default_temperature is not None:
            return self.default_temperature
        return fallback

    def qualify(self, model_id: str) -> str:
        """把來源的原生模型名稱轉成全域唯一的合格名稱。"""
        return f"{self.id}/{model_id}"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # --- 模型來源 ---
    # 多來源設定，JSON 陣列字串；留空則退回下方單一 LITELLM_* 設定。
    llm_providers: str = ""

    # --- 單一來源（向下相容；LLM_PROVIDERS 未設定時使用）---
    litellm_base_url: str = "http://localhost:4000"
    litellm_api_key: str = ""
    litellm_timeout: float = 120.0

    # --- 模型 ---
    # 預設模型，可寫合格名稱（來源/模型）或裸模型名稱
    default_model: str = "gpt-4o-mini"
    # 全域白名單，以逗號分隔；留空代表不額外過濾
    allowed_models: str = ""
    # 全域預設 temperature；來源與模型都沒指定時採用
    default_temperature: float = 0.7

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

    @field_validator(
        "litellm_timeout", "jwt_expire_minutes", "default_temperature", mode="before"
    )
    @classmethod
    def _blank_numeric_to_default(cls, value: object, info: ValidationInfo) -> object:
        """空字串視為未設定，改用預設值。

        Coolify 之類的平台會把 compose 裡宣告過、但使用者沒填值的環境變數
        以空字串注入；若不處理，數值型欄位會在啟動時解析失敗導致整個服務起不來。
        """
        if isinstance(value, str) and not value.strip():
            return cls.model_fields[info.field_name].default
        return value

    @field_validator("default_temperature")
    @classmethod
    def _validate_default_temperature(cls, value: float) -> float:
        return _check_temperature(value, "DEFAULT_TEMPERATURE")

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

    @cached_property
    def providers(self) -> list[ProviderConfig]:
        """解析出所有模型來源；LLM_PROVIDERS 優先，否則退回單一 LiteLLM 設定。"""
        raw = self.llm_providers.strip()
        if not raw:
            return [
                ProviderConfig(
                    id="litellm",
                    label="LiteLLM",
                    base_url=self.litellm_url,
                    api_key=self.litellm_api_key,
                    timeout=self.litellm_timeout,
                )
            ]

        try:
            parsed = json.loads(raw)
        except ValueError as exc:
            raise ValueError(f"LLM_PROVIDERS 不是合法的 JSON：{exc}") from exc
        if not isinstance(parsed, list) or not parsed:
            raise ValueError("LLM_PROVIDERS 必須是非空的 JSON 陣列。")

        providers = [ProviderConfig(**item) for item in parsed]
        seen: set[str] = set()
        for provider in providers:
            if provider.id in seen:
                raise ValueError(f"LLM_PROVIDERS 中的來源 id「{provider.id}」重複。")
            seen.add(provider.id)
        return providers

    @cached_property
    def provider_map(self) -> dict[str, ProviderConfig]:
        return {provider.id: provider for provider in self.providers}

    def split_model(self, model: str) -> tuple[ProviderConfig, str]:
        """把「來源/模型」拆成 (來源設定, 原生模型名稱)。

        沒有已知來源前綴時，視為預設（第一個）來源的裸模型名稱。
        """
        model = (model or "").strip()
        if "/" in model:
            head, rest = model.split("/", 1)
            provider = self.provider_map.get(head)
            if provider is not None and rest:
                return provider, rest
        return self.providers[0], model


@lru_cache
def get_settings() -> Settings:
    return Settings()
