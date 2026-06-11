from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status

from app.deps import GeocodeServiceDep
from app.schemas.geocode import GeocodeResult, ReverseGeocodeResult
from app.services.geocode import GeocodeError

router = APIRouter(prefix="/geocode", tags=["geocode"])

_UNAVAILABLE = "Geocoding service is unavailable"


@router.get("/search", response_model=list[GeocodeResult])
async def search(
    service: GeocodeServiceDep,
    q: Annotated[str, Query(min_length=1, description="Place name to search for.")],
) -> list[GeocodeResult]:
    try:
        return await service.search(q)
    except GeocodeError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, _UNAVAILABLE) from exc


@router.get("/reverse", response_model=ReverseGeocodeResult)
async def reverse(
    service: GeocodeServiceDep,
    lat: Annotated[float, Query(ge=-90, le=90)],
    lng: Annotated[float, Query(ge=-180, le=180)],
) -> ReverseGeocodeResult:
    try:
        return await service.reverse(lat, lng)
    except GeocodeError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, _UNAVAILABLE) from exc
