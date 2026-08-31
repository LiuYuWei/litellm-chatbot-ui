"""與 OpenAI 相容後端（LiteLLM Proxy、vLLM…）溝通的用戶端。"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, AsyncIterator

import httpx

from .config import ProviderConfig

logger = logging.getLogger(__name__)


class LLMError(Exception):
    """呼叫模型來源失敗時拋出，帶有可回傳給前端的狀態碼與訊息。"""

    def __init__(self, message: str, status_code: int = 502) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class LLMClient:
    """單一模型來源的用戶端，每個來源各自持有連線池與 API Key。"""

    def __init__(self, provider: ProviderConfig) -> None:
        self.provider = provider
        self._client = httpx.AsyncClient(
            base_url=provider.base_url,
            timeout=httpx.Timeout(provider.timeout, connect=10.0),
        )

    @property
    def id(self) -> str:
        return self.provider.id

    @property
    def label(self) -> str:
        return self.provider.label

    async def aclose(self) -> None:
        await self._client.aclose()

    @property
    def _headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.provider.api_key:
            headers["Authorization"] = f"Bearer {self.provider.api_key}"
        return headers

    def _error(self, message: str, status_code: int) -> LLMError:
        """錯誤訊息一律標註來源，多來源時才分得出是哪一台出問題。"""
        return LLMError(f"[{self.label}] {message}", status_code)

    @staticmethod
    def _extract_error(response_text: str, status_code: int) -> str:
        """盡量從後端的錯誤回應中取出可讀訊息。"""
        try:
            data = json.loads(response_text)
        except (ValueError, TypeError):
            return response_text[:500] or f"回應錯誤（HTTP {status_code}）"
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
            raise self._error(f"無法連線：{exc}", 503) from exc

        if response.status_code >= 400:
            raise self._error(
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
            raise self._error(f"無法連線：{exc}", 503) from exc

        if response.status_code >= 400:
            raise self._error(
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
                    yield _sse_error(f"[{self.label}] {message}")
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
            logger.warning("串流呼叫 %s 失敗：%s", self.id, exc)
            yield _sse_error(f"[{self.label}] 連線中斷：{exc}")


class ClientRegistry:
    """依 id 保存所有來源的用戶端；第一個來源同時作為預設來源。"""

    def __init__(self, providers: list[ProviderConfig]) -> None:
        self._clients: dict[str, LLMClient] = {
            provider.id: LLMClient(provider) for provider in providers
        }
        self._order = [provider.id for provider in providers]

    def __iter__(self):
        return (self._clients[pid] for pid in self._order)

    def __len__(self) -> int:
        return len(self._order)

    @property
    def default(self) -> LLMClient:
        return self._clients[self._order[0]]

    def get(self, provider_id: str) -> LLMClient:
        client = self._clients.get(provider_id)
        if client is None:
            raise LLMError(f"未知的模型來源「{provider_id}」。", 400)
        return client

    async def aclose(self) -> None:
        await asyncio.gather(
            *(client.aclose() for client in self._clients.values()),
            return_exceptions=True,
        )


def _sse_error(message: str) -> str:
    return f"data: {json.dumps({'error': {'message': message}}, ensure_ascii=False)}\n\n"
