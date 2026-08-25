"""對話端點：把請求轉發給 LiteLLM，並以 SSE 串流回傳。"""

from __future__ import annotations

import logging
from typing import Any, AsyncIterator

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse

from ..auth import get_current_user
from ..config import Settings, get_settings
from ..litellm_client import LiteLLMClient, LiteLLMError
from ..schemas import ChatRequest

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["chat"])

SSE_HEADERS = {
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",  # 避免 Nginx 之類的反向代理緩衝串流
}


def _resolve_model(requested: str | None, settings: Settings) -> str:
    """決定實際使用的模型，並確認未超出白名單。"""
    allowlist = settings.model_allowlist
    model = (requested or settings.default_model).strip()
    if allowlist and model not in allowlist:
        raise HTTPException(status_code=400, detail=f"不允許使用模型「{model}」。")
    return model


def _build_payload(body: ChatRequest, model: str) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "model": model,
        "messages": [m.model_dump() for m in body.messages],
        "temperature": body.temperature,
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
    client: LiteLLMClient = request.app.state.litellm
    model = _resolve_model(body.model, settings)
    payload = _build_payload(body, model)
    logger.info("使用者 %s 以模型 %s 發送對話請求", username, model)

    if not body.stream:
        try:
            result = await client.chat_completion(payload)
        except LiteLLMError as exc:
            raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
        return JSONResponse(result)

    async def event_stream() -> AsyncIterator[bytes]:
        async for chunk in client.stream_chat_completion(payload):
            yield chunk.encode("utf-8")

    return StreamingResponse(
        event_stream(), media_type="text/event-stream", headers=SSE_HEADERS
    )
