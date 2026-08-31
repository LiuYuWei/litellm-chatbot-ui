"""彙整所有來源的模型清單：併發抓取、套用白名單、標註各來源狀態。"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from .config import ProviderConfig, Settings
from .llm_client import ClientRegistry, LLMError
from .schemas import ModelInfo, ProviderStatus

logger = logging.getLogger(__name__)


def _is_allowed(
    native_id: str, qualified_id: str, provider: ProviderConfig, global_allow: set[str]
) -> bool:
    """白名單同時接受原生名稱與「來源/模型」合格名稱。"""
    if provider.allowed_models and native_id not in provider.allowed_models:
        return False
    if global_allow and native_id not in global_allow and qualified_id not in global_allow:
        return False
    return True


def _fallback_models(provider: ProviderConfig, global_allow: set[str]) -> list[str]:
    """來源連不上時，改用白名單撐出可選模型，讓使用者仍能送出請求。"""
    if provider.allowed_models:
        return list(provider.allowed_models)
    prefix = f"{provider.id}/"
    return [m[len(prefix):] for m in global_allow if m.startswith(prefix)]


async def collect_models(
    registry: ClientRegistry, settings: Settings
) -> tuple[list[ModelInfo], list[ProviderStatus]]:
    """併發向所有來源要模型清單；單一來源失敗不影響其他來源。"""
    clients = list(registry)
    results: list[Any] = await asyncio.gather(
        *(client.list_models() for client in clients), return_exceptions=True
    )

    global_allow = set(settings.model_allowlist)
    models: list[ModelInfo] = []
    statuses: list[ProviderStatus] = []

    for client, result in zip(clients, results):
        provider = client.provider

        if isinstance(result, BaseException):
            message = result.message if isinstance(result, LLMError) else str(result)
            logger.warning("來源 %s 取得模型清單失敗：%s", provider.id, message)
            models.extend(
                ModelInfo(
                    id=provider.qualify(native),
                    model=native,
                    provider=provider.id,
                    provider_label=provider.label,
                )
                for native in _fallback_models(provider, global_allow)
            )
            statuses.append(
                ProviderStatus(
                    id=provider.id,
                    label=provider.label,
                    base_url=provider.base_url,
                    reachable=False,
                    model_count=0,
                    error=message,
                )
            )
            continue

        count = 0
        for item in result:
            native = str(item["id"])
            qualified = provider.qualify(native)
            if not _is_allowed(native, qualified, provider, global_allow):
                continue
            models.append(
                ModelInfo(
                    id=qualified,
                    model=native,
                    provider=provider.id,
                    provider_label=provider.label,
                    owned_by=item.get("owned_by"),
                )
            )
            count += 1

        statuses.append(
            ProviderStatus(
                id=provider.id,
                label=provider.label,
                base_url=provider.base_url,
                reachable=True,
                model_count=count,
            )
        )

    return models, statuses


def resolve_default_model(models: list[ModelInfo], settings: Settings) -> str:
    """把 DEFAULT_MODEL 轉成合格名稱；不在清單中時退回第一個可用模型。"""
    provider, native = settings.split_model(settings.default_model)
    default = provider.qualify(native) if native else ""
    available = {m.id for m in models}
    if default in available:
        return default
    return models[0].id if models else default
