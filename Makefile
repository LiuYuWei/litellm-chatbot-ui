# ============================================================
#  LiteLLM Chatbot UI - 開發與部署指令
#  執行 `make help` 可列出所有可用指令
# ============================================================

SHELL := /bin/bash
.DEFAULT_GOAL := help

PYTHON      ?= python3
VENV        := .venv
VENV_PY     := $(VENV)/bin/python
VENV_PIP    := $(VENV)/bin/pip
APP_PORT    ?= 8000
COMPOSE     := docker compose
IMAGE       := litellm-chatbot-ui:latest

# 顏色
CYAN  := \033[36m
BOLD  := \033[1m
RESET := \033[0m

.PHONY: help env secret install install-backend install-frontend \
        dev dev-backend dev-frontend build typecheck run \
        docker-build up down restart logs ps health shell clean clean-all

# ------------------------------------------------------------
# 說明
# ------------------------------------------------------------
help: ## 顯示所有可用指令
	@printf "\n$(BOLD)LiteLLM Chatbot UI$(RESET)\n\n"
	@printf "  用法：make $(CYAN)<target>$(RESET)\n\n"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  $(CYAN)%-18s$(RESET) %s\n", $$1, $$2}'
	@printf "\n  $(BOLD)最快上手：$(RESET)make env → 編輯 .env → make up\n\n"

# ------------------------------------------------------------
# 環境設定
# ------------------------------------------------------------
env: ## 由 .env.example 建立 .env（已存在則不覆蓋）
	@if [ -f .env ]; then \
		printf "  .env 已存在，未做任何變更。\n"; \
	else \
		cp .env.example .env; \
		printf "  已建立 .env，請填入 LLM_PROVIDERS（或單一來源的 LITELLM_BASE_URL／LITELLM_API_KEY）與 AUTH_USERS。\n"; \
	fi

secret: ## 產生一組隨機的 JWT_SECRET
	@$(PYTHON) -c "import secrets; print('JWT_SECRET=' + secrets.token_urlsafe(48))"

# ------------------------------------------------------------
# 本機開發
# ------------------------------------------------------------
install: install-backend install-frontend ## 安裝前後端所有相依套件

install-backend: ## 建立 Python 虛擬環境並安裝後端套件
	@test -d $(VENV) || $(PYTHON) -m venv $(VENV)
	@$(VENV_PIP) install --quiet --upgrade pip
	@$(VENV_PIP) install --quiet -r backend/requirements.txt
	@printf "  後端套件安裝完成（$(VENV)）。\n"

install-frontend: ## 安裝前端 npm 套件
	@cd frontend && npm install
	@printf "  前端套件安裝完成。\n"

dev: ## 同時啟動前後端開發伺服器（前端 5173、後端 8000）
	@printf "  後端 http://localhost:8000　前端 http://localhost:5173\n"
	@printf "  按 Ctrl+C 可同時結束兩者。\n\n"
	@trap 'kill 0' EXIT INT TERM; \
		$(MAKE) dev-backend & \
		$(MAKE) dev-frontend & \
		wait

dev-backend: ## 只啟動後端（附帶自動重載）
	@cd backend && ../$(VENV_PY) -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

dev-frontend: ## 只啟動前端 Vite 開發伺服器
	@cd frontend && npm run dev

typecheck: ## 執行前端 TypeScript 型別檢查
	@cd frontend && npm run typecheck

build: ## 建置前端並輸出到 backend/static
	@cd frontend && npm run build
	@printf "  前端建置完成，產物位於 backend/static。\n"

run: build ## 以單一服務啟動（前端已建置，統一由 8000 埠提供）
	@printf "  服務啟動於 http://localhost:8000\n\n"
	@cd backend && ../$(VENV_PY) -m uvicorn app.main:app --host 0.0.0.0 --port 8000

# ------------------------------------------------------------
# Docker
# ------------------------------------------------------------
docker-build: ## 建置 Docker 映像檔
	@docker build -t $(IMAGE) .
	@printf "  映像檔建置完成：$(IMAGE)\n"

up: env ## 建置並在背景啟動容器
	@$(COMPOSE) up --build -d
	@printf "\n  服務已啟動：http://localhost:$(APP_PORT)\n"
	@printf "  查看日誌請執行：make logs\n\n"

down: ## 停止並移除容器
	@$(COMPOSE) down
	@printf "  容器已停止。\n"

restart: ## 重新啟動容器
	@$(COMPOSE) restart
	@printf "  容器已重新啟動。\n"

logs: ## 即時查看容器日誌
	@$(COMPOSE) logs -f

ps: ## 查看容器狀態
	@$(COMPOSE) ps

shell: ## 進入執行中容器的 shell
	@$(COMPOSE) exec chatbot-ui /bin/bash

health: ## 檢查服務健康狀態與 LiteLLM 連線
	@curl -fsS http://localhost:$(APP_PORT)/api/health \
		&& printf "\n" \
		|| printf "  服務無回應，請確認容器是否啟動（make ps）。\n"

# ------------------------------------------------------------
# 清理
# ------------------------------------------------------------
clean: ## 清除建置產物與快取
	@rm -rf backend/static frontend/dist
	@find . -type d -name __pycache__ -not -path "./.venv/*" -exec rm -rf {} + 2>/dev/null || true
	@printf "  建置產物已清除。\n"

clean-all: clean ## 清除建置產物、虛擬環境與 node_modules
	@rm -rf $(VENV) frontend/node_modules
	@printf "  相依套件已一併清除。\n"
