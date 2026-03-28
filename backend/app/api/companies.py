"""Routes pour la recherche d'entreprises."""

from typing import List, Optional

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser
from app.models.schemas import CompanyResponse
from app.services.sirene import search_companies

router = APIRouter()


@router.get("/search", response_model=List[CompanyResponse])
async def search(
    user: CurrentUser,
    location: str = Query(..., description="Ville ou code postal"),
    radius_km: int = Query(30, ge=5, le=200),
    naf_codes: Optional[str] = Query(None, description="Codes NAF séparés par des virgules"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
) -> List[dict]:
    """Recherche des entreprises via l'API SIRENE autour d'une localisation."""
    naf_list = naf_codes.split(",") if naf_codes else None
    companies = await search_companies(
        location=location,
        radius_km=radius_km,
        naf_codes=naf_list,
        page=page,
        per_page=per_page,
    )
    return companies
