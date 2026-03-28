"""Tâche Celery : envoi d'email de candidature via Gmail."""

import asyncio
from datetime import datetime, timezone

from app.tasks.celery_app import celery_app
from app.db.client import get_supabase_admin
from app.services.gmail import send_email


@celery_app.task(bind=True, name="tasks.send_application_email")
def send_application_email(self, application_id: str, user_id: str) -> dict:
    """Envoie un email de candidature et met à jour le statut."""
    return asyncio.run(_send(self, application_id, user_id))


async def _send(task, application_id: str, user_id: str) -> dict:
    supabase = get_supabase_admin()

    # Récupérer l'application avec l'entreprise et le contact
    app_data = (
        supabase.table("applications")
        .select("*, company:companies(*), contact:email_contacts(*)")
        .eq("id", application_id)
        .single()
        .execute()
    ).data

    if not app_data:
        return {"error": "Candidature non trouvée"}

    if app_data["status"] not in ("approved", "pending_review"):
        return {"error": f"Statut invalide : {app_data['status']}"}

    contact = app_data.get("contact")
    company = app_data.get("company")

    if not contact or not contact.get("email"):
        return {"error": "Aucun email de contact"}

    # Récupérer le profil pour le CV
    profile = (
        supabase.table("profiles")
        .select("full_name, cv_url")
        .eq("id", user_id)
        .single()
        .execute()
    ).data

    # Construire le sujet
    campaign = (
        supabase.table("campaigns")
        .select("job_title, contract_type")
        .eq("id", app_data["campaign_id"])
        .single()
        .execute()
    ).data

    subject = f"Candidature spontanée — {campaign['job_title']}"
    if campaign.get("contract_type") in ("stage", "alternance"):
        subject = f"Candidature {campaign['contract_type']} — {campaign['job_title']}"

    # Télécharger le CV si disponible
    cv_content = None
    cv_filename = None
    if profile and profile.get("cv_url"):
        try:
            import httpx
            async with httpx.AsyncClient() as client:
                cv_response = await client.get(profile["cv_url"])
                if cv_response.status_code == 200:
                    cv_content = cv_response.content
                    cv_filename = f"CV_{profile.get('full_name', 'candidat').replace(' ', '_')}.pdf"
        except Exception:
            pass

    # Envoyer l'email
    result = await send_email(
        user_id=user_id,
        to_email=contact["email"],
        subject=subject,
        body=app_data.get("cover_letter", ""),
        cv_content=cv_content,
        cv_filename=cv_filename,
    )

    # Mettre à jour le statut
    now = datetime.now(timezone.utc).isoformat()
    supabase.table("applications").update({
        "status": "sent",
        "sent_at": now,
    }).eq("id", application_id).execute()

    # Logger l'email envoyé
    supabase.table("email_logs").insert({
        "application_id": application_id,
        "direction": "outbound",
        "subject": subject,
        "body": app_data.get("cover_letter", ""),
        "gmail_message_id": result.get("message_id"),
    }).execute()

    return {"status": "sent", "message_id": result.get("message_id")}
