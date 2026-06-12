#!/bin/sh
set -e

# Apply any pending database migrations before the app starts, so anyone who
# just pulls the image and runs `docker compose up` stays on the latest schema
# with no manual migration step. The compose files gate the app on a healthy
# `db`, so the database is reachable by the time this runs.
alembic upgrade head

exec "$@"
