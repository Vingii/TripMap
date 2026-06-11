from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.services.geocode import GeocodeService

SessionDep = Annotated[AsyncSession, Depends(get_session)]


def get_geocode_service(request: Request) -> GeocodeService:
    service: GeocodeService = request.app.state.geocode_service
    return service


GeocodeServiceDep = Annotated[GeocodeService, Depends(get_geocode_service)]
