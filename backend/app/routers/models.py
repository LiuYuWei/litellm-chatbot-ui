"""模型清單端點：彙整所有來源的可用模型。"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request

from ..auth import get_current_user
from ..catalog import collect_models, resolve_default_model
from ..config import Settings, get_settings
from ..llm_client import ClientRegistry
from ..schemas import ModelListResponse

router = APIRouter(prefix="/api", tags=["models"])


@router.get("/models", response_model=ModelListResponse)
async def list_models(
    request: Request,
    _: str = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> ModelListResponse:
    registry: ClientRegistry = request.app.state.llm
    models, providers = await collect_models(registry, settings)

    if not models and all(not p.reachable for p in providers):
        # 全部來源都掛了才視為錯誤；只要有一個活著就照常回傳。
        detail = "；".join(p.error for p in providers if p.error) or "所有模型來源都無法連線。"
        raise HTTPException(status_code=503, detail=detail)

    return ModelListResponse(
        models=models,
        default_model=resolve_default_model(models, settings),
        providers=providers,
    )
