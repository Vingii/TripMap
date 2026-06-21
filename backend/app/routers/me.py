from fastapi import APIRouter

from app.deps import CurrentUserDep, SessionDep
from app.models.user import User
from app.schemas.user import UserRead, UserSettings, UserSettingsUpdate
from app.services import users as service

router = APIRouter(prefix="/me", tags=["me"])


def _to_read(user: User) -> UserRead:
    return UserRead(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        settings=UserSettings.model_validate(user.settings),
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


@router.get("", response_model=UserRead)
async def get_me(user: CurrentUserDep) -> UserRead:
    return _to_read(user)


@router.get("/settings", response_model=UserSettings)
async def get_my_settings(user: CurrentUserDep) -> UserSettings:
    return UserSettings.model_validate(user.settings)


@router.patch("/settings", response_model=UserSettings)
async def update_my_settings(
    db: SessionDep, user: CurrentUserDep, payload: UserSettingsUpdate
) -> UserSettings:
    return await service.update_settings(db, user, payload.model_dump(exclude_unset=True))
