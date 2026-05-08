# TripMap Backend

FastAPI service for TripMap.

## Prerequisites

- [uv](https://docs.astral.sh/uv/) (installs Python 3.12 automatically)

## Setup

```sh
uv sync
```

## Run

```sh
uv run uvicorn app.main:app --reload
```

Swagger UI: http://localhost:8000/docs
Health check: http://localhost:8000/health

## Quality checks

```sh
uv run ruff check .
uv run mypy --strict app
uv run pytest
```
