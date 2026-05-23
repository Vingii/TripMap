# TripMap

Self-hosted trip and vacation tracker built around a rich, interactive map. Log the places you've been, browse them on a world map, and revisit your travels through a visualisation tailored to how you actually remember your trips.

## Features

- **Map-first browsing** — every visited location renders on an interactive Leaflet map; pan, zoom, and click pins to see details.
- **Location logging** — record places you've visited with notes, dates, and precise coordinates.
- **Self-hosted** — runs entirely on your own infrastructure via Docker; your travel history stays yours.
- **Single-sign-on** — authentication delegated to your own OIDC provider (Authentik), so you don't manage another password.

## Tech stack

| Layer    | Choice                                                              |
| -------- | ------------------------------------------------------------------- |
| Backend  | Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2 (async), Alembic    |
| Frontend | Vue 3, TypeScript, Vite, Pinia, Vue Router, Leaflet.js, Tailwind CSS |
| Database | PostgreSQL 16 + PostGIS 3                                           |
| Auth     | OIDC via Authentik (Authorization Code + PKCE)                      |
| Packaging | Docker (multi-stage) + Docker Compose — one image serves the SPA and API |

## License

[MIT](LICENSE)
