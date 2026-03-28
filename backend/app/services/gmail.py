"""Service d'envoi d'emails via Gmail OAuth."""

import base64
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from typing import Optional

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from app.config import get_settings
from app.db.client import get_supabase_admin


async def send_email(
    user_id: str,
    to_email: str,
    subject: str,
    body: str,
    cv_content: Optional[bytes] = None,
    cv_filename: Optional[str] = None,
) -> dict:
    """
    Envoie un email depuis le compte Gmail de l'utilisateur.
    Retourne le message_id Gmail.
    """
    settings = get_settings()
    supabase = get_supabase_admin()

    # Récupérer le token OAuth Gmail de l'utilisateur
    profile = (
        supabase.table("profiles")
        .select("gmail_token, full_name, cv_url")
        .eq("id", user_id)
        .single()
        .execute()
    )

    if not profile.data or not profile.data.get("gmail_token"):
        raise ValueError("Token Gmail non configuré. Connectez votre compte Google.")

    token_data = profile.data["gmail_token"]
    credentials = _build_credentials(token_data)

    # Rafraîchir le token si nécessaire
    if credentials.expired and credentials.refresh_token:
        credentials.refresh(Request())
        # Sauvegarder le nouveau token
        supabase.table("profiles").update({
            "gmail_token": {
                "token": credentials.token,
                "refresh_token": credentials.refresh_token,
                "token_uri": credentials.token_uri,
                "client_id": credentials.client_id,
                "client_secret": credentials.client_secret,
            }
        }).eq("id", user_id).execute()

    # Construire l'email
    service = build("gmail", "v1", credentials=credentials)
    message = _build_message(
        sender_name=profile.data.get("full_name", ""),
        to_email=to_email,
        subject=subject,
        body=body,
        cv_content=cv_content,
        cv_filename=cv_filename,
    )

    # Envoyer
    result = service.users().messages().send(
        userId="me",
        body={"raw": message},
    ).execute()

    return {
        "message_id": result.get("id"),
        "thread_id": result.get("threadId"),
    }


def _build_credentials(token_data: dict) -> Credentials:
    """Reconstruit un objet Credentials depuis les données stockées."""
    settings = get_settings()
    return Credentials(
        token=token_data.get("token"),
        refresh_token=token_data.get("refresh_token"),
        token_uri="https://oauth2.googleapis.com/token",
        client_id=token_data.get("client_id", settings.google_client_id),
        client_secret=token_data.get("client_secret", settings.google_client_secret),
    )


def _build_message(
    sender_name: str,
    to_email: str,
    subject: str,
    body: str,
    cv_content: bytes | None = None,
    cv_filename: str | None = None,
) -> str:
    """Construit un email MIME encodé en base64 pour l'API Gmail."""
    msg = MIMEMultipart()
    msg["To"] = to_email
    msg["Subject"] = subject

    if sender_name:
        msg["From"] = sender_name

    # Corps du message en HTML
    html_body = body.replace("\n", "<br>")
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    # Pièce jointe CV si fournie
    if cv_content and cv_filename:
        attachment = MIMEApplication(cv_content, Name=cv_filename)
        attachment["Content-Disposition"] = f'attachment; filename="{cv_filename}"'
        msg.attach(attachment)

    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode("utf-8")
    return raw
