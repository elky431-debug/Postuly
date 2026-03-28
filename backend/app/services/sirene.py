"""Service de recherche d'entreprises via l'API INSEE SIRENE + géocodage."""

from typing import Optional, List

import httpx

from app.config import get_settings
from app.db.client import get_supabase_admin

API_SIRENE_URL = "https://api.insee.fr/entreprises/sirene/V3.11/siret"
API_GEO_URL = "https://api-adresse.data.gouv.fr/search/"


async def geocode_location(location: str) -> Optional[dict]:
    """Géocode une ville via l'API Adresse du gouvernement."""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            API_GEO_URL,
            params={"q": location, "type": "municipality", "limit": 1},
        )
        data = response.json()

        if not data.get("features"):
            return None

        feature = data["features"][0]
        return {
            "lat": feature["geometry"]["coordinates"][1],
            "lon": feature["geometry"]["coordinates"][0],
            "city": feature["properties"].get("city", location),
            "postcode": feature["properties"].get("postcode", ""),
            "department": feature["properties"].get("context", "").split(",")[0].strip(),
        }


async def search_companies(
    location: str,
    radius_km: int = 30,
    naf_codes: Optional[List[str]] = None,
    page: int = 1,
    per_page: int = 20,
) -> List[dict]:
    """
    Recherche des entreprises via l'API SIRENE.
    Filtre par localisation (département) et codes NAF.
    """
    settings = get_settings()
    geo = await geocode_location(location)

    if not geo:
        return []

    # Construire la requête SIRENE
    # On filtre par département (les 2 premiers chiffres du code postal)
    dept = geo["postcode"][:2] if geo.get("postcode") else ""

    query_parts: list[str] = []
    if dept:
        query_parts.append(f"codePostalEtablissement:{dept}*")

    if naf_codes:
        naf_filter = " OR ".join(
            f"activitePrincipaleEtablissement:{code}" for code in naf_codes
        )
        query_parts.append(f"({naf_filter})")

    # Exclure les entreprises fermées
    query_parts.append("etatAdministratifEtablissement:A")

    q = " AND ".join(query_parts)

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                API_SIRENE_URL,
                params={
                    "q": q,
                    "nombre": per_page,
                    "debut": (page - 1) * per_page,
                },
                headers={
                    "Authorization": f"Bearer {settings.insee_api_key}",
                    "Accept": "application/json",
                },
                timeout=30.0,
            )

            if response.status_code != 200:
                return []

            data = response.json()
            etablissements = data.get("etablissements", [])

    except httpx.HTTPError:
        return []

    # Transformer et sauvegarder
    companies: list[dict] = []
    supabase = get_supabase_admin()

    for etab in etablissements:
        unite_legale = etab.get("uniteLegale", {})
        adresse = etab.get("adresseEtablissement", {})
        periods = etab.get("periodesEtablissement", [{}])
        current_period = periods[0] if periods else {}

        company_data = {
            "siret": etab.get("siret"),
            "name": _get_company_name(unite_legale),
            "address": _build_address(adresse),
            "city": adresse.get("libelleCommuneEtablissement", ""),
            "postal_code": adresse.get("codePostalEtablissement", ""),
            "naf_code": current_period.get("activitePrincipaleEtablissement", ""),
            "size_range": unite_legale.get("trancheEffectifsUniteLegale", ""),
        }

        # Upsert dans la base
        try:
            result = (
                supabase.table("companies")
                .upsert(company_data, on_conflict="siret")
                .execute()
            )
            if result.data:
                companies.append(result.data[0])
        except Exception:
            companies.append(company_data)

    return companies


def _get_company_name(unite_legale: dict) -> str:
    """Extrait le nom de l'entreprise depuis les données SIRENE."""
    denomination = unite_legale.get("denominationUniteLegale")
    if denomination:
        return denomination

    prenom = unite_legale.get("prenomUsuelUniteLegale", "")
    nom = unite_legale.get("nomUniteLegale", "")
    return f"{prenom} {nom}".strip() or "Entreprise inconnue"


def _build_address(adresse: dict) -> str:
    """Construit l'adresse complète depuis les champs SIRENE."""
    parts = [
        adresse.get("numeroVoieEtablissement", ""),
        adresse.get("typeVoieEtablissement", ""),
        adresse.get("libelleVoieEtablissement", ""),
    ]
    street = " ".join(p for p in parts if p).strip()
    postal = adresse.get("codePostalEtablissement", "")
    city = adresse.get("libelleCommuneEtablissement", "")
    return f"{street}, {postal} {city}".strip(", ")
