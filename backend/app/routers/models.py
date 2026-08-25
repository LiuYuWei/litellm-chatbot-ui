"""模型清單端點。"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request

from ..auth import get_current_user
from ..config import Settings, get_settings
from ..litellm_client import LiteLLMClient, LiteLLMError
from ..schemas import ModelInfo, ModelListResponse

router = APIRouter(prefix="/api", tags=["models"])


@router.get("/models", response_model=ModelListResponse)
async def list_models(
    request: Request,
    _: str = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> ModelListResponse:
    client: LiteLLMClient = request.app.state.litellm
    allowlist = settings.model_allowlist

    try:
        raw_models = await client.list_models()
    except LiteLLMError as exc:
        if allowlist:
            # LiteLLM 暫時無法連線時，仍以白名單提供可選模型。
            return ModelListResponse(
                models=[ModelInfo(id=m) for m in allowlist],
                default_model=settings.default_model,
            )
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    models = [
        ModelInfo(id=item["id"], owned_by=item.get("owned_by")) for item in raw_models
    ]
    if allowlist:
        allowed = set(allowlist)
        filtered = [m for m in models if m.id in allowed]
        models = filtered or [ModelInfo(id=m) for m in allowlist]

    default_model = settings.default_model
    if models and default_model not in {m.id for m in models}:
        default_model = models[0].id

    return ModelListResponse(models=models, default_model=default_model)
