# syntax=docker/dockerfile:1.7

# --- Stage 1: build the Vue frontend ---
FROM node:20-alpine AS frontend
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- Stage 2: install Python deps into a venv at the runtime path ---
FROM python:3.12-slim AS backend
RUN pip install --no-cache-dir uv
ENV UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    UV_PROJECT_ENVIRONMENT=/app/.venv
WORKDIR /build
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

# --- Stage 3: runtime image ---
FROM python:3.12-slim AS runtime
RUN groupadd --system app \
 && useradd --system --gid app --create-home --shell /usr/sbin/nologin app
WORKDIR /app
COPY --from=backend /app/.venv /app/.venv
COPY --chown=app:app backend/app /app/app
COPY --from=frontend --chown=app:app /build/dist /app/static
USER app
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    STATIC_DIR=/app/static
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
