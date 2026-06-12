import uuid

from fastapi import APIRouter, HTTPException, status

from app.deps import GeocodeServiceDep, SessionDep
from app.schemas.location import LocationCreate, LocationRead, LocationUpdate
from app.services import locations as service

router = APIRouter(prefix="/locations", tags=["locations"])

_NOT_FOUND = "Location not found"


@router.get("", response_model=list[LocationRead])
async def list_locations(db: SessionDep) -> list[LocationRead]:
    return await service.list_locations(db)


@router.post("", response_model=LocationRead, status_code=status.HTTP_201_CREATED)
async def create_location(
    db: SessionDep, geocode: GeocodeServiceDep, payload: LocationCreate
) -> LocationRead:
    return await service.create_location(db, geocode, payload)


@router.get("/{location_id}", response_model=LocationRead)
async def get_location(db: SessionDep, location_id: uuid.UUID) -> LocationRead:
    location = await service.get_location(db, location_id)
    if location is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, _NOT_FOUND)
    return location


@router.patch("/{location_id}", response_model=LocationRead)
async def update_location(
    db: SessionDep, geocode: GeocodeServiceDep, location_id: uuid.UUID, payload: LocationUpdate
) -> LocationRead:
    location = await service.update_location(db, geocode, location_id, payload)
    if location is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, _NOT_FOUND)
    return location


@router.delete("/{location_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_location(db: SessionDep, location_id: uuid.UUID) -> None:
    if not await service.delete_location(db, location_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, _NOT_FOUND)
