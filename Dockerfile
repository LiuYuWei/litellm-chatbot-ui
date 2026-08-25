# syntax=docker/dockerfile:1

# ---------- 第一階段：建置前端 ----------
FROM node:22-alpine AS frontend-builder

WORKDIR /build/frontend

# 先複製相依定義，讓 npm ci 這層能被 Docker 快取。
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
# vite.config.ts 會把產物輸出到 /build/backend/static
RUN npm run build


# ---------- 第二階段：執行後端 ----------
FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# 以非 root 使用者執行
RUN groupadd --system app && useradd --system --gid app --home-dir /app app

COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app ./app
COPY --from=frontend-builder /build/backend/static ./static

USER app

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request, sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=3).status == 200 else 1)"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
