"""Routes pour la gestion des candidatures."""

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query

from app.api.deps import CurrentUser
from app.db.client import get_supabase_admin
from app.models.schemas import ApplicationResponse, ApplicationUpdate

router = APIRouter()


@router.get("/", response_model=List[ApplicationResponse])
async def list_applications(
    user: CurrentUser,
    campaign_id: Optional[UUID] = Query(None),
    status: Optional[str] = Query(None),
) -> List[dict]:
    """Liste les candidatures, avec filtres optionnels."""
    supabase = get_supabase_admin()

    query = (
        supabase.table("applications")
        .select("*, company:companies(*), contact:email_contacts(*)")
    )

    if campaign_id:
        query = query.eq("campaign_id", str(campaign_id))

    if status:
        query = query.eq("status", status)

    # Filtrer par user via les campagnes
    user_campaigns = (
        supabase.table("campaigns")
        .select("id")
        .eq("user_id", user["id"])
        .execute()
    )
    campaign_ids = [c["id"] for c in user_campaigns.data]

    if not campaign_ids:
        return []

    query = query.in_("campaign_id", campaign_ids)
    response = query.order("created_at", desc=True).execute()

    return response.data


@router.get("/{application_id}", response_model=ApplicationResponse)
async def get_application(application_id: UUID, user: CurrentUser) -> dict:
    """Récupère une candidature avec les détails entreprise et contact."""
    supabase = get_supabase_admin()

    response = (
        supabase.table("applications")
        .select("*, company:companies(*), contact:email_contacts(*)")
        .eq("id", str(application_id))
        .single()
        .execute()
    )

    if not response.data:
        raise HTTPException(status_code=404, detail="Candidature non trouvée")

    # Vérifier que la campagne appartient à l'utilisateur
    campaign = (
        supabase.table("campaigns")
        .select("user_id")
        .eq("id", response.data["campaign_id"])
        .single()
        .execute()
    )

    if not campaign.data or campaign.data["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Accès non autorisé")

    return response.data


@router.patch("/{application_id}", response_model=ApplicationResponse)
async def update_application(
    application_id: UUID, body: ApplicationUpdate, user: CurrentUser
) -> dict:
    """Met à jour une candidature (lettre, statut, notes)."""
    supabase = get_supabase_admin()
    update_data = body.model_dump(exclude_unset=True)

    if not update_data:
        raise HTTPException(status_code=400, detail="Aucune donnée à mettre à jour")

    # Vérifier l'accès
    existing = (
        supabase.table("applications")
        .select("campaign_id")
        .eq("id", str(application_id))
        .single()
        .execute()
    )

    if not existing.data:
        raise HTTPException(status_code=404, detail="Candidature non trouvée")

    campaign = (
        supabase.table("campaigns")
        .select("user_id")
        .eq("id", existing.data["campaign_id"])
        .single()
        .execute()
    )

    if not campaign.data or campaign.data["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Accès non autorisé")

    response = (
        supabase.table("applications")
        .update(update_data)
        .eq("id", str(application_id))
        .execute()
    )

    return response.data[0]


@router.post("/{application_id}/approve")
async def approve_application(application_id: UUID, user: CurrentUser) -> dict:
    """Approuve une candidature pour l'envoi."""
    supabase = get_supabase_admin()

    response = (
        supabase.table("applications")
        .update({"status": "approved"})
        .eq("id", str(application_id))
        .eq("status", "pending_review")
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=400,
            detail="Candidature introuvable ou déjà approuvée",
        )

    return {"message": "Candidature approuvée", "application_id": str(application_id)}


@router.post("/{application_id}/send")
async def send_application(application_id: UUID, user: CurrentUser) -> dict:
    """Envoie l'email de candidature via Gmail OAuth."""
    from app.tasks.email_sender import send_application_email

    send_application_email.delay(
        application_id=str(application_id),
        user_id=user["id"],
    )

    return {
        "message": "Envoi en cours...",
        "application_id": str(application_id),
    }
