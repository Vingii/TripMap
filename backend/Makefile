.PHONY: migrate migrate-down migrate-revision

migrate:
	uv run alembic upgrade head

migrate-down:
	uv run alembic downgrade -1

migrate-revision:
	uv run alembic revision --autogenerate -m "$(m)"
