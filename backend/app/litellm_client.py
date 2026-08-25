"""與 LiteLLM Proxy（OpenAI 相容 API）溝通的用戶端。"""

from __future__ import annotations

import json
import logging
from typing import Any, AsyncIterator

import httpx

from .config import Settings

logger = logging.getLogger(__name__)


class LiteLLMError(Exception):
    """呼叫 LiteLLM 失敗時拋出，帶有可回傳給前端的狀態碼與訊息。"""

    def __init__(self, message: str, status_code: int = 502) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class LiteLLMClient:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._client = httpx.AsyncClient(
            base_url=settings.litellm_url,
            timeout=httpx.Timeout(settings.litellm_timeout, connect=10.0),
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    @property
    def _headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.settings.litellm_api_key:
            headers["Authorization"] = f"Bearer {self.settings.litellm_api_key}"
        return headers

    @staticmethod
    def _extract_error(response_text: str, status_code: int) -> str:
        """盡量從 LiteLLM 的錯誤回應中取出可讀訊息。"""
        try:
            data = json.loads(response_text)
        except (ValueError, TypeError):
            return response_text[:500] or f"LiteLLM 回應錯誤（HTTP {status_code}）"
        error = data.get("error") if isinstance(data, dict) else None
        if isinstance(error, dict):
            return str(error.get("message") or error)
        if isinstance(error, str):
            return error
        if isinstance(data, dict) and "detail" in data:
            return str(data["detail"])
        return response_text[:500]

    async def list_models(self) -> list[dict[str, Any]]:
        try:
            response = await self._client.get("/v1/models", headers=self._headers)
        except httpx.HTTPError as exc:
            raise LiteLLMError(f"無法連線至 LiteLLM：{exc}", 503) from exc

        if response.status_code >= 400:
            raise LiteLLMError(
                self._extract_error(response.text, response.status_code),
                response.status_code,
            )

        payload = response.json()
        data = payload.get("data", []) if isinstance(payload, dict) else []
        return [item for item in data if isinstance(item, dict) and item.get("id")]

    async def chat_completion(self, payload: dict[str, Any]) -> dict[str, Any]:
        """非串流模式的對話補全。"""
        try:
            response = await self._client.post(
                "/v1/chat/completions", headers=self._headers, json=payload
            )
        except httpx.HTTPError as exc:
            raise LiteLLMError(f"無法連線至 LiteLLM：{exc}", 503) from exc

        if response.status_code >= 400:
            raise LiteLLMError(
                self._extract_error(response.text, response.status_code),
                response.status_code,
            )
        return response.json()

    async def stream_chat_completion(
        self, payload: dict[str, Any]
    ) -> AsyncIterator[str]:
        """串流模式：逐段吐出 SSE 事件字串（含結尾換行）。"""
        body = {**payload, "stream": True}
        try:
            async with self._client.stream(
                "POST", "/v1/chat/completions", headers=self._headers, json=body
            ) as response:
                if response.status_code >= 400:
                    raw = (await response.aread()).decode("utf-8", errors="replace")
                    message = self._extract_error(raw, response.status_code)
                    yield _sse_error(message)
                    return

                async for line in response.aiter_lines():
                    if not line:
                        continue
                    if line.startswith("data:"):
                        yield f"{line}\n\n"
                    elif line.startswith(":"):
                        continue
                    else:
                        # 少數後端不加 data: 前綴，補上以維持 SSE 格式。
                        yield f"data: {line}\n\n"
        except httpx.HTTPError as exc:
            logger.warning("串流呼叫 LiteLLM 失敗：%s", exc)
            yield _sse_error(f"與 LiteLLM 的連線中斷：{exc}")


def _sse_error(message: str) -> str:
    return f"data: {json.dumps({'error': {'message': message}}, ensure_ascii=False)}\n\n"
