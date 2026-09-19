from fastapi import APIRouter

from app.deps import CurrentUserDep, SessionDep
from app.models.user import User
from app.schemas.user import UserRead, UserSettings, UserSettingsRead, UserSettingsUpdate
from app.services import users as service

router = APIRouter(prefix="/me", tags=["me"])


def _to_read(user: User) -> UserRead:
    return UserRead(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        settings=UserSettingsRead.from_settings(UserSettings.model_validate(user.settings)),
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


@router.get("", response_model=UserRead)
async def get_me(user: CurrentUserDep) -> UserRead:
    return _to_read(user)


@router.get("/settings", response_model=UserSettingsRead)
async def get_my_settings(user: CurrentUserDep) -> UserSettingsRead:
    return UserSettingsRead.from_settings(UserSettings.model_validate(user.settings))


@router.patch("/settings", response_model=UserSettingsRead)
async def update_my_settings(
    db: SessionDep, user: CurrentUserDep, payload: UserSettingsUpdate
) -> UserSettingsRead:
    settings = await service.update_settings(db, user, payload.model_dump(exclude_unset=True))
    return UserSettingsRead.from_settings(settings)
