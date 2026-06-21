"""User persistence keyed off OIDC identity.

There is no separate sign-up flow: the first time a verified token is seen, the
matching ``User`` row is created from its claims. Profile fields are refreshed on
later requests so a display-name or email change at the IdP propagates.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.schemas.user import UserSettings
from app.services.auth import TokenClaims


async def get_or_create_user(db: AsyncSession, claims: TokenClaims) -> User:
    user = (await db.execute(select(User).where(User.oidc_sub == claims.sub))).scalar_one_or_none()

    if user is None:
        user = User(
            oidc_sub=claims.sub,
            email=claims.email or "",
            display_name=claims.name,
            settings={},
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user

    changed = False
    if claims.email and user.email != claims.email:
        user.email = claims.email
        changed = True
    if claims.name is not None and user.display_name != claims.name:
        user.display_name = claims.name
        changed = True
    if changed:
        await db.commit()
        await db.refresh(user)
    return user


async def update_settings(db: AsyncSession, user: User, patch: dict[str, object]) -> UserSettings:
    """Merge a partial settings patch onto the user's stored settings.

    The merged result is validated through ``UserSettings`` before persisting, so
    only known keys with valid values are ever stored.
    """
    merged = {**user.settings, **patch}
    settings = UserSettings.model_validate(merged)
    user.settings = settings.model_dump()
    await db.commit()
    return settings
