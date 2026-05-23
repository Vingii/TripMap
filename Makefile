.PHONY: test test-backend test-frontend lint lint-backend lint-frontend

test: test-backend test-frontend

test-backend:
	cd backend && uv run pytest

test-frontend:
	cd frontend && npm run test:unit

lint: lint-backend lint-frontend

lint-backend:
	cd backend && uv run ruff check .
	cd backend && uv run ruff format --check .
	cd backend && uv run mypy --strict app

lint-frontend:
	cd frontend && npm run lint
