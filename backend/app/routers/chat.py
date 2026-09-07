"""對話端點：依模型所屬來源轉發請求，並以 SSE 串流回傳。"""

from __future__ import annotations

import logging
from typing import Any, AsyncIterator

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse

from ..auth import get_current_user
from ..config import ProviderConfig, Settings, get_settings
from ..llm_client import ClientRegistry, LLMClient, LLMError
from ..schemas import ChatRequest

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["chat"])

SSE_HEADERS = {
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",  # 避免 Nginx 之類的反向代理緩衝串流
}


def _resolve_target(
    body: ChatRequest, settings: Settings
) -> tuple[ProviderConfig, str]:
    """決定要用哪個來源、哪個原生模型名稱，並確認未超出白名單。"""
    requested = (body.model or settings.default_model).strip()

    if body.provider:
        # 明確指定來源時以它為準，model 若帶前綴則剝掉。
        provider = settings.provider_map.get(body.provider)
        if provider is None:
            raise HTTPException(
                status_code=400, detail=f"未知的模型來源「{body.provider}」。"
            )
        prefix = f"{provider.id}/"
        model = requested[len(prefix):] if requested.startswith(prefix) else requested
    else:
        provider, model = settings.split_model(requested)

    if not model:
        raise HTTPException(status_code=400, detail="未指定模型。")

    qualified = provider.qualify(model)
    if provider.allowed_models and model not in provider.allowed_models:
        raise HTTPException(
            status_code=400, detail=f"來源「{provider.label}」不允許使用模型「{model}」。"
        )
    global_allow = settings.model_allowlist
    if global_allow and model not in global_allow and qualified not in global_allow:
        raise HTTPException(status_code=400, detail=f"不允許使用模型「{qualified}」。")

    return provider, model


def _build_payload(body: ChatRequest, model: str, temperature: float) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "model": model,
        "messages": [m.model_dump() for m in body.messages],
        "temperature": temperature,
    }
    if body.max_tokens:
        payload["max_tokens"] = body.max_tokens
    return payload


@router.post("/chat")
async def chat(
    body: ChatRequest,
    request: Request,
    username: str = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    registry: ClientRegistry = request.app.state.llm
    provider, model = _resolve_target(body, settings)

    try:
        client: LLMClient = registry.get(provider.id)
    except LLMError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    # 使用者沒指定時，採用該模型的預設值（模型 > 來源 > 全域）。
    temperature = (
        body.temperature
        if body.temperature is not None
        else provider.temperature_for(model, settings.default_temperature)
    )
    payload = _build_payload(body, model, temperature)
    logger.info(
        "使用者 %s 以 %s 的模型 %s（temperature=%s）發送對話請求",
        username, provider.id, model, temperature,
    )

    if not body.stream:
        try:
            result = await client.chat_completion(payload)
        except LLMError as exc:
            raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
        return JSONResponse(result)

    async def event_stream() -> AsyncIterator[bytes]:
        async for chunk in client.stream_chat_completion(payload):
            yield chunk.encode("utf-8")

    return StreamingResponse(
        event_stream(), media_type="text/event-stream", headers=SSE_HEADERS
    )
