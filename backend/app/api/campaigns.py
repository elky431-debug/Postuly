"""Routes pour la gestion des campagnes de candidature."""

from uuid import UUID

from fastapi import APIRouter, HTTPException

from app.api.deps import CurrentUser
from app.db.client import get_supabase_admin
from app.models.schemas import (
    CampaignCreate,
    CampaignResponse,
    CampaignUpdate,
    CampaignLaunchResponse,
)

router = APIRouter()


@router.get("/", response_model=list[CampaignResponse])
async def list_campaigns(user: CurrentUser) -> list[dict]:
    """Liste toutes les campagnes de l'utilisateur."""
    supabase = get_supabase_admin()
    response = (
        supabase.table("campaigns")
        .select("*")
        .eq("user_id", user["id"])
        .order("created_at", desc=True)
        .execute()
    )
    return response.data


@router.post("/", response_model=CampaignResponse, status_code=201)
async def create_campaign(body: CampaignCreate, user: CurrentUser) -> dict:
    """Crée une nouvelle campagne."""
    supabase = get_supabase_admin()
    data = body.model_dump()
    data["user_id"] = user["id"]

    response = supabase.table("campaigns").insert(data).execute()

    if not response.data:
        raise HTTPException(status_code=500, detail="Erreur lors de la création")

    return response.data[0]


@router.get("/{campaign_id}", response_model=CampaignResponse)
async def get_campaign(campaign_id: UUID, user: CurrentUser) -> dict:
    """Récupère une campagne par son ID."""
    supabase = get_supabase_admin()
    response = (
        supabase.table("campaigns")
        .select("*")
        .eq("id", str(campaign_id))
        .eq("user_id", user["id"])
        .single()
        .execute()
    )

    if not response.data:
        raise HTTPException(status_code=404, detail="Campagne non trouvée")

    return response.data


@router.patch("/{campaign_id}", response_model=CampaignResponse)
async def update_campaign(
    campaign_id: UUID, body: CampaignUpdate, user: CurrentUser
) -> dict:
    """Met à jour une campagne existante."""
    supabase = get_supabase_admin()
    update_data = body.model_dump(exclude_unset=True)

    if not update_data:
        raise HTTPException(status_code=400, detail="Aucune donnée à mettre à jour")

    response = (
        supabase.table("campaigns")
        .update(update_data)
        .eq("id", str(campaign_id))
        .eq("user_id", user["id"])
        .execute()
    )

    if not response.data:
        raise HTTPException(status_code=404, detail="Campagne non trouvée")

    return response.data[0]


@router.delete("/{campaign_id}", status_code=204)
async def delete_campaign(campaign_id: UUID, user: CurrentUser) -> None:
    """Supprime une campagne."""
    supabase = get_supabase_admin()
    supabase.table("campaigns").delete().eq("id", str(campaign_id)).eq(
        "user_id", user["id"]
    ).execute()


@router.post("/{campaign_id}/launch", response_model=CampaignLaunchResponse)
async def launch_campaign(campaign_id: UUID, user: CurrentUser) -> dict:
    """
    Lance une campagne :
    1. Recherche entreprises via SIRENE
    2. Scraping emails (tâche Celery)
    3. Génération lettres IA (tâche Celery)
    4. Crée les fiches applications en pending_review
    """
    supabase = get_supabase_admin()

    # Vérifier que la campagne existe et appartient à l'utilisateur
    campaign = (
        supabase.table("campaigns")
        .select("*")
        .eq("id", str(campaign_id))
        .eq("user_id", user["id"])
        .single()
        .execute()
    )

    if not campaign.data:
        raise HTTPException(status_code=404, detail="Campagne non trouvée")

    if campaign.data["status"] != "draft":
        raise HTTPException(
            status_code=400,
            detail="Seule une campagne en brouillon peut être lancée",
        )

    # Lancer la tâche Celery de pipeline complet
    from app.tasks.pipeline import run_campaign_pipeline

    run_campaign_pipeline.delay(
        campaign_id=str(campaign_id),
        user_id=user["id"],
    )

    # Passer la campagne en running
    supabase.table("campaigns").update({"status": "running"}).eq(
        "id", str(campaign_id)
    ).execute()

    return {
        "campaign_id": campaign_id,
        "companies_found": 0,
        "emails_found": 0,
        "applications_created": 0,
        "message": "Pipeline lancé en arrière-plan. Les candidatures apparaîtront progressivement.",
    }
