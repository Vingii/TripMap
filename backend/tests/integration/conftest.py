"""Auth fixtures for integration tests.

All endpoints (except health and the SPA) now require an authenticated user.
Rather than mint real OIDC tokens, these fixtures override the ``get_current_user``
dependency with a database-backed test user. Tokens themselves are exercised in
the unit tests for ``OIDCVerifier``.

A test marked ``@pytest.mark.noauth`` skips the override so it can assert the
unauthenticated behaviour (401) against the real dependency.
"""

from collections.abc import AsyncIterator, Callable, Iterator

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.deps import get_current_user
from app.main import app
from app.models.user import User
from app.services.auth import OIDCVerifier, create_oidc_verifier

Login = Callable[[User], None]


@pytest.fixture(autouse=True)
async def oidc_verifier() -> AsyncIterator[OIDCVerifier]:
    """Install a real (but unconfigured) verifier on app state.

    ASGITransport does not run the lifespan, so nothing else populates this.
    Authenticated tests override ``get_current_user`` and never touch it;
    ``noauth`` tests rely on it resolving cleanly so a missing/invalid token
    surfaces as 401.
    """
    verifier = create_oidc_verifier(get_settings())
    app.state.oidc_verifier = verifier
    yield verifier
    await verifier.aclose()


@pytest.fixture
async def auth_user(db_session: AsyncSession) -> User:
    user = User(
        oidc_sub="test|user-1",
        email="tester@example.com",
        display_name="Tester",
        settings={},
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture(autouse=True)
def authenticate(request: pytest.FixtureRequest, auth_user: User) -> Iterator[Login]:
    """Authenticate requests as ``auth_user`` by default.

    Yields a callable so a test can re-authenticate as a different user (used to
    assert per-user isolation of visited state).
    """
    if "noauth" in request.keywords:
        yield lambda _user: None
        return

    def login(user: User) -> None:
        app.dependency_overrides[get_current_user] = lambda: user

    login(auth_user)
    yield login
    app.dependency_overrides.pop(get_current_user, None)
