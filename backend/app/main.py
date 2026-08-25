"""FastAPI 應用進入點：提供 API 與前端靜態檔案。"""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .config import get_settings
from .litellm_client import LiteLLMClient, LiteLLMError
from .routers import auth as auth_router
from .routers import chat as chat_router
from .routers import models as models_router
from .schemas import HealthResponse

settings = get_settings()
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
)
logger = logging.getLogger("litellm_chatbot")


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.litellm = LiteLLMClient(settings)
    logger.info("已啟動，LiteLLM 位址：%s", settings.litellm_url)
    if settings.jwt_secret == "please-change-this-secret-in-production":
        logger.warning("JWT_SECRET 仍是預設值，正式環境請務必更換！")
    if not settings.users:
        logger.error("AUTH_USERS 未設定任何帳號，將無人可登入。")
    try:
        yield
    finally:
        await app.state.litellm.aclose()
        logger.info("已關閉 LiteLLM 連線。")


app = FastAPI(
    title=settings.app_name,
    description="以 LiteLLM 為後端的對話 UI，支援登入驗證與串流回覆。",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(chat_router.router)
app.include_router(models_router.router)


@app.get("/api/health", response_model=HealthResponse, tags=["system"])
async def health(request: Request) -> HealthResponse:
    """健康檢查，同時回報 LiteLLM 是否可連線。"""
    reachable: bool | None
    try:
        await request.app.state.litellm.list_models()
        reachable = True
    except LiteLLMError:
        reachable = False
    return HealthResponse(
        status="ok",
        app=settings.app_name,
        litellm_base_url=settings.litellm_url,
        litellm_reachable=reachable,
    )


# --- 前端靜態檔案（Docker 映像中由前端建置產物填入）---
STATIC_DIR = Path(os.environ.get("STATIC_DIR", settings.static_dir))
if not STATIC_DIR.is_absolute():
    STATIC_DIR = (Path(__file__).resolve().parent.parent / STATIC_DIR).resolve()

if STATIC_DIR.is_dir():
    assets_dir = STATIC_DIR / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str):
        """單頁應用路由：實體檔案優先，其餘一律回傳 index.html。"""
        if full_path.startswith("api/"):
            return JSONResponse({"detail": "Not Found"}, status_code=404)
        candidate = (STATIC_DIR / full_path).resolve()
        if (
            full_path
            and STATIC_DIR in candidate.parents
            and candidate.is_file()
        ):
            return FileResponse(candidate)
        index = STATIC_DIR / "index.html"
        if index.is_file():
            return FileResponse(index)
        return JSONResponse({"detail": "Not Found"}, status_code=404)

else:
    logger.info("找不到前端靜態目錄 %s，僅提供 API（開發模式請用 Vite dev server）。", STATIC_DIR)

    @app.get("/", include_in_schema=False)
    async def root() -> JSONResponse:
        return JSONResponse(
            {
                "app": settings.app_name,
                "message": "API 服務運作中。前端開發請執行 make dev-frontend。",
                "docs": "/docs",
            }
        )
