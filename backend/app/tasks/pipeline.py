"""Tâche Celery : pipeline complet d'une campagne."""

import asyncio
from app.tasks.celery_app import celery_app
from app.db.client import get_supabase_admin
from app.services.sirene import search_companies
from app.services.website_finder import find_website
from app.services.email_scraper import scrape_emails_for_company
from app.services.cover_letter import generate_cover_letter


@celery_app.task(bind=True, name="tasks.run_campaign_pipeline")
def run_campaign_pipeline(self, campaign_id: str, user_id: str) -> dict:
    """
    Pipeline complet :
    1. Rechercher les entreprises (SIRENE)
    2. Trouver les sites web
    3. Scraper les emails RH
    4. Générer les lettres de motivation
    5. Créer les fiches applications en pending_review
    """
    return asyncio.run(_run_pipeline(self, campaign_id, user_id))


async def _run_pipeline(task, campaign_id: str, user_id: str) -> dict:
    supabase = get_supabase_admin()

    # Récupérer la campagne
    campaign = (
        supabase.table("campaigns")
        .select("*")
        .eq("id", campaign_id)
        .single()
        .execute()
    ).data

    if not campaign:
        return {"error": "Campagne non trouvée"}

    # Récupérer le profil utilisateur
    profile = (
        supabase.table("profiles")
        .select("*")
        .eq("id", user_id)
        .single()
        .execute()
    ).data

    stats = {
        "companies_found": 0,
        "websites_found": 0,
        "emails_found": 0,
        "letters_generated": 0,
        "applications_created": 0,
    }

    # Étape 1 : Rechercher les entreprises
    task.update_state(state="PROGRESS", meta={"step": "Recherche d'entreprises..."})
    companies = await search_companies(
        location=campaign["location"],
        radius_km=campaign["radius_km"],
    )
    stats["companies_found"] = len(companies)

    if not companies:
        supabase.table("campaigns").update({"status": "completed"}).eq("id", campaign_id).execute()
        return stats

    # Étape 2 & 3 : Pour chaque entreprise, trouver le site et scraper les emails
    for i, company in enumerate(companies):
        company_id = company.get("id")
        if not company_id:
            continue

        task.update_state(
            state="PROGRESS",
            meta={"step": f"Traitement entreprise {i+1}/{len(companies)} : {company.get('name', '')}"},
        )

        # Trouver le site web si pas déjà connu
        if not company.get("website_url"):
            website = await find_website(company["name"], company.get("city", ""))
            if website:
                supabase.table("companies").update(
                    {"website_url": website}
                ).eq("id", company_id).execute()
                company["website_url"] = website
                stats["websites_found"] += 1

        # Scraper les emails
        if company.get("website_url"):
            emails = await scrape_emails_for_company(company_id, company["website_url"])
            if emails:
                stats["emails_found"] += len(emails)

                # Récupérer le premier contact email
                contact = (
                    supabase.table("email_contacts")
                    .select("id")
                    .eq("company_id", company_id)
                    .limit(1)
                    .execute()
                ).data

                contact_id = contact[0]["id"] if contact else None

                # Étape 4 : Générer la lettre
                try:
                    result = await generate_cover_letter(
                        user_profile=profile,
                        company=company,
                        job_title=campaign["job_title"],
                        contract_type=campaign["contract_type"],
                    )
                    cover_letter = result["cover_letter"]
                    stats["letters_generated"] += 1
                except Exception:
                    cover_letter = None

                # Étape 5 : Créer l'application
                supabase.table("applications").insert({
                    "campaign_id": campaign_id,
                    "company_id": company_id,
                    "contact_id": contact_id,
                    "cover_letter": cover_letter,
                    "status": "pending_review",
                }).execute()
                stats["applications_created"] += 1

    # Mettre à jour le statut de la campagne
    supabase.table("campaigns").update({"status": "paused"}).eq("id", campaign_id).execute()

    return stats
