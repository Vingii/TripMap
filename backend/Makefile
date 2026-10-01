.PHONY: migrate migrate-down migrate-revision backfill-subdivisions

migrate:
	uv run alembic upgrade head

migrate-down:
	uv run alembic downgrade -1

migrate-revision:
	uv run alembic revision --autogenerate -m "$(m)"

# Fill in subdivision_codes for locations that were never resolved.
# One Nominatim call per location, rate-limited; safe to re-run.
backfill-subdivisions:
	uv run python -m app.scripts.backfill_subdivision_codes
