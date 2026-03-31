"""Routes pour la gestion des campagnes de candidature."""

import traceback
from uuid import UUID

from fastapi import APIRouter, HTTPException

from app.api.deps import CurrentUser
from app.db.client import get_supabase_admin
from app.models.schemas import (
    CampaignCreate,
    CampaignResponse,
    CampaignUpdate,
    CampaignLaunchResponse,
    CampaignFromSelectionBody,
    CampaignFromSelectionResponse,
)
from app.services.cover_letter import generate_cover_letter

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


@router.post(
    "/from-selection",
    response_model=CampaignFromSelectionResponse,
    status_code=201,
)
async def create_campaign_from_selection(
    body: CampaignFromSelectionBody, user: CurrentUser
) -> dict:
    """
    Crée une campagne + une candidature par contact (lettre IA) en statut « approved »,
    prête pour l’envoi n8n via la route Next `/api/n8n/launch-campaign`.
    """
    supabase = get_supabase_admin()

    prof = (
        supabase.table("profiles")
        .select("*")
        .eq("id", user["id"])
        .maybe_single()
        .execute()
    )
    profile = (prof.data if prof is not None and prof.data else {}) or {}

    job_title = (body.job_title or "").strip() or "Candidature spontanée"
    location = (body.location or "").strip() or (
        body.destinations[0].ville if body.destinations else "France"
    )
    contract_type = body.contract_type or "cdi"

    camp_ins = (
        supabase.table("campaigns")
        .insert(
            {
                "user_id": user["id"],
                "job_title": job_title,
                "location": location,
                "radius_km": 30,
                "contract_type": contract_type,
                "status": "draft",
            }
        )
        .execute()
    )
    if camp_ins is None or not camp_ins.data:
        raise HTTPException(status_code=500, detail="Création campagne impossible")
    campaign_id = camp_ins.data[0]["id"]

    created = 0
    for dest in body.destinations:
        c = dest.contact

        existing = (
            supabase.table("companies")
            .select("id")
            .eq("siret", dest.siret)
            .maybe_single()
            .execute()
        )
        if existing is not None and existing.data:
            company_id = existing.data["id"]
        else:
            ins_co = (
                supabase.table("companies")
                .insert(
                    {
                        "siret": dest.siret,
                        "name": dest.nom,
                        "city": dest.ville or None,
                        "postal_code": dest.code_postal or None,
                        "naf_code": dest.naf or None,
                        "naf_label": dest.libelle_naf or None,
                        "size_range": dest.taille or None,
                    }
                )
                .execute()
            )
            if ins_co is None or not ins_co.data:
                continue
            company_id = ins_co.data[0]["id"]

        name_parts = [c.first_name, c.last_name]
        contact_name = " ".join(x for x in name_parts if x).strip() or None

        email_norm = c.email.strip()
        ec_existing = (
            supabase.table("email_contacts")
            .select("id")
            .eq("company_id", company_id)
            .eq("email", email_norm)
            .maybe_single()
            .execute()
        )
        if ec_existing is not None and ec_existing.data:
            contact_id = ec_existing.data["id"]
        else:
            ins_ec = (
                supabase.table("email_contacts")
                .insert(
                    {
                        "company_id": company_id,
                        "email": email_norm,
                        "source": "scraped",
                        "verified": False,
                        "name": contact_name,
                        "role": c.position,
                        "department": c.department,
                        "confidence": c.confidence or 0,
                    }
                )
                .execute()
            )
            if ins_ec is None or not ins_ec.data:
                continue
            contact_id = ins_ec.data[0]["id"]

        company_for_prompt = {
            "name": dest.nom,
            "city": dest.ville,
            "naf_label": dest.libelle_naf or dest.domaine or "",
            "naf_code": dest.naf or "",
        }
        try:
            gen = await generate_cover_letter(
                user_profile=profile,
                company=company_for_prompt,
                job_title=job_title,
                contract_type=contract_type,
            )
            cover_letter = gen.get("cover_letter") or ""
        except Exception as e:
            print("ERREUR GÉNÉRATION LETTRE:", str(e))
            traceback.print_exc()
            cover_letter = ""

        supabase.table("applications").insert(
            {
                "campaign_id": campaign_id,
                "company_id": company_id,
                "contact_id": contact_id,
                "cover_letter": cover_letter or None,
                "status": "approved",
            }
        ).execute()
        created += 1

    if created == 0:
        supabase.table("campaigns").delete().eq("id", campaign_id).execute()
        raise HTTPException(
            status_code=400,
            detail="Aucune candidature créée (vérifie les contacts).",
        )

    return {
        "campaign_id": campaign_id,
        "applications_created": created,
        "message": f"{created} candidature(s) créée(s) avec lettre IA — lance l’envoi n8n depuis l’app.",
    }


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
