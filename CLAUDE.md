# TripMap — Claude Code Guide

Self-hosted trip/vacation tracker. Primary deliverable: a rich map visualisation where users log and explore locations they've visited.

## Tech stack

| Layer | Choice |
|---|---|
| Backend | Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2 (async + asyncpg), Alembic |
| Frontend | Vue 3, TypeScript, Vite, Vue Router 4, Pinia, Leaflet.js, Tailwind CSS |
| Database | PostgreSQL 16 + PostGIS 3 |
| Auth | OIDC via Authentik (Authorization Code + PKCE) |
| Container | Docker (multi-stage), Docker Compose |
| CI/CD | GitHub Actions — pytest + Vitest on PRs; Docker Hub publish on main |
| E2E | Playwright |

## Repository layout

```
/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI app factory
│   │   ├── deps.py          # Shared dependencies (db session, current user)
│   │   ├── routers/         # One file per resource (locations.py, albums.py, …)
│   │   ├── models/          # SQLAlchemy ORM models
│   │   ├── schemas/         # Pydantic request/response schemas
│   │   └── services/        # Business logic (no DB calls in routers)
│   ├── tests/
│   │   ├── unit/            # Pure function tests; mock DB and external services
│   │   └── integration/     # Route tests against a real PostgreSQL test instance
│   ├── alembic/
│   └── pyproject.toml
├── frontend/
│   ├── src/
│   │   ├── api/             # All HTTP calls — never call fetch/axios from components
│   │   ├── assets/geo/      # Bundled GeoJSON (Natural Earth admin-0 + admin-1)
│   │   ├── components/      # Reusable UI components (PascalCase filenames)
│   │   ├── stores/          # Pinia stores
│   │   ├── router/
│   │   └── views/           # Route-level components
│   ├── e2e/                 # Playwright tests
│   └── package.json
├── Dockerfile
├── docker-compose.yml       # Local dev (hot-reload)
├── docker-compose.prod.yml  # Production
└── CLAUDE.md
```

## Python conventions

- **Formatter/linter**: Ruff — configured in `pyproject.toml`; runs in CI
- **Type hints**: strict everywhere — all function signatures and return types must be annotated; `mypy --strict` runs in CI; no bare `Any` without an explanatory `# type: ignore` comment
- **Async throughout**: all route handlers, services, and DB calls are `async`; use SQLAlchemy async session
- **Dependency injection**: use FastAPI `Depends()` for DB sessions, current user, etc. — no module-level global state
- **Schema/model separation**: never return ORM model instances from routes; always go through a Pydantic schema (`response_model=` on every route decorator)
- **Services layer**: DB queries live in `services/`, not in routers; routers handle HTTP concerns only

## Vue / TypeScript conventions

- **SFC style**: `<script setup lang="ts">` in every component — no Options API
- **Styling**: Tailwind CSS utility classes only — no `<style>` blocks in SFCs unless unavoidable
- **No `any`**: use `unknown` and narrow it; `// eslint-disable` requires a comment explaining why
- **API calls**: all `fetch`/axios calls go through `src/api/`; components and stores import from there
- **Store style**: Pinia `defineStore` with the composition API style (not option object)
- **Naming**: component files in PascalCase (`MapPin.vue`), used in templates as kebab-case (`<map-pin />`)

## API design

- **Bare objects**: list endpoints return `[…]`, single-object endpoints return `{…}`; no envelope wrapper
- **Errors**: HTTP status codes + FastAPI's default `{"detail": "…"}` body
- **Route naming**: plural nouns, kebab-case paths — `/locations`, `/albums/{id}/locations`
- **Auth**: all endpoints require a valid JWT bearer token except `GET /health` and `POST /auth/*`

## Database conventions

- Column names: `snake_case`
- Every table has `id`, `created_at`, `updated_at`
- Location coordinates: PostGIS `GEOGRAPHY(Point, 4326)` column
- Schema changes go through Alembic migrations — never modify the DB schema by hand

## Testing conventions

- All tests live in `backend/tests/`; directory structure mirrors `backend/app/`
- All async test functions use `pytest-asyncio`
- **Unit tests** (`tests/unit/`): pure functions and business logic in isolation; mock the DB session and external services
- **Integration tests** (`tests/integration/`): route handlers tested end-to-end against a real PostgreSQL test instance; never mock the DB in integration tests
- Integration tests use a separate test database configured via `TEST_DATABASE_URL`; migrations are applied before the test run
- E2E tests in `frontend/e2e/` using Playwright; run headless in CI

## Local development

### Backend

The backend is a [uv](https://docs.astral.sh/uv/)-managed Python 3.12 project under `backend/`. uv handles the Python toolchain, virtualenv, and lockfile — there's no need to create a venv by hand.

```sh
cd backend
uv sync                                    # install deps into .venv (first run only)
uv run uvicorn app.main:app --reload       # http://localhost:8000 (Swagger at /docs)
uv run pytest                              # full test suite
uv run pytest tests/unit                   # unit tests only
uv run pytest tests/integration            # integration tests only
uv run ruff check .                        # lint
uv run ruff format .                       # format
uv run mypy --strict app                   # type-check
```

Integration tests require a Postgres test database reachable at `TEST_DATABASE_URL`; unit tests do not.

### Pre-commit hooks

`.pre-commit-config.yaml` at the repo root runs `ruff` (lint + format) and `mypy --strict` against staged `backend/**.py` files. Install once after cloning:

```sh
uvx pre-commit install                     # or `pip install pre-commit && pre-commit install`
```

Hooks then run automatically on every commit. To run them manually against the whole tree: `uvx pre-commit run --all-files`.

## Dev workflow

Use the `/dev` skill to pick up a YouTrack task and implement it end-to-end.
Branch format: `TM-{ID}-{slug}` — e.g. `TM-14-location-crud`.
PRs target `main`; one feature or fix per branch.
