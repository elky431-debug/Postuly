"""Service d'envoi d'emails via Gmail OAuth."""

import base64
import html
import re
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from typing import Optional
from urllib.parse import unquote, urlparse

import httpx

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from app.config import get_settings
from app.crypto_tokens import maybe_decrypt_token, maybe_encrypt_token
from app.db.client import get_supabase_admin


def _plain_text_to_html_body(body: str) -> str:
    """Convertit du texte brut en HTML à paragraphes ; laisse l’HTML déjà présent inchangé."""
    t = (body or "").strip()
    if not t:
        return ""
    lower = t.lower()
    if "<p" in lower or "<br" in lower or "<div" in lower:
        return t
    esc = html.escape(t)
    blocks = [b.strip() for b in re.split(r"\n\s*\n", esc) if b.strip()]
    if not blocks:
        return f'<p style="margin:0 0 1em 0;line-height:1.6;">{esc}</p>'
    parts: list[str] = []
    for b in blocks:
        inner = b.replace("\n", "<br>")
        parts.append(f'<p style="margin:0 0 1em 0;line-height:1.6;">{inner}</p>')
    return "".join(parts)


def _cv_storage_path_from_public_url(url: str) -> Optional[str]:
    """Chemin relatif dans le bucket « cvs » depuis une URL publique Supabase."""
    marker = "/cvs/"
    if marker not in url:
        return None
    path = url.split(marker, 1)[1].split("?", 1)[0].strip()
    return path or None


def _cv_filename_from_url(cv_url: str, full_name: str) -> str:
    path_last = unquote(urlparse(cv_url).path.rsplit("/", 1)[-1] or "")
    if path_last and "." in path_last:
        return path_last
    safe = (full_name or "candidat").replace(" ", "_")
    return f"CV_{safe}.pdf"


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
    if not (settings.google_client_id and settings.google_client_secret):
        raise ValueError(
            "Google OAuth manquant côté backend : définis GOOGLE_CLIENT_ID et "
            "GOOGLE_CLIENT_SECRET dans backend/.env (mêmes valeurs que sur le frontend)."
        )

    supabase = get_supabase_admin()

    profile = (
        supabase.table("profiles")
        .select("full_name, cv_url")
        .eq("id", user_id)
        .single()
        .execute()
    )

    token_row = (
        supabase.table("gmail_tokens")
        .select("access_token, refresh_token, token_expiry, gmail_email")
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )

    if not token_row.data or not token_row.data.get("access_token"):
        raise ValueError("Token Gmail non configuré. Connectez votre compte Google.")

    enc_secret = settings.encryption_key.strip()
    access_plain = maybe_decrypt_token(token_row.data["access_token"], enc_secret)
    refresh_plain = maybe_decrypt_token(token_row.data["refresh_token"], enc_secret)

    token_data = {
        "token": access_plain,
        "refresh_token": refresh_plain,
    }
    credentials = _build_credentials(token_data)

    # Rafraîchir le token si nécessaire
    if credentials.expired and credentials.refresh_token:
        credentials.refresh(Request())
        upd: dict = {
            "access_token": maybe_encrypt_token(credentials.token, enc_secret)
            or credentials.token,
            "token_expiry": credentials.expiry.isoformat()
            if credentials.expiry
            else None,
        }
        if credentials.refresh_token:
            upd["refresh_token"] = (
                maybe_encrypt_token(credentials.refresh_token, enc_secret)
                or credentials.refresh_token
            )
        supabase.table("gmail_tokens").update(upd).eq("user_id", user_id).execute()

    pdata = profile.data if profile and getattr(profile, "data", None) else {}
    cv_bytes = cv_content
    cv_name = cv_filename
    if cv_bytes is None and pdata.get("cv_url"):
        cv_ref = str(pdata["cv_url"]).strip()
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                r = await client.get(cv_ref)
                if r.status_code == 200 and r.content:
                    cv_bytes = r.content
                    cv_name = _cv_filename_from_url(cv_ref, str(pdata.get("full_name") or ""))
        except Exception:
            cv_bytes = cv_content
            cv_name = cv_filename
        if cv_bytes is None and cv_ref:
            spath = _cv_storage_path_from_public_url(cv_ref)
            if spath:
                try:
                    raw = supabase.storage.from_("cvs").download(spath)
                    if raw:
                        cv_bytes = raw
                        cv_name = _cv_filename_from_url(
                            cv_ref, str(pdata.get("full_name") or "")
                        )
                except Exception:
                    cv_bytes = cv_content
                    cv_name = cv_filename

    # Construire l'email
    service = build("gmail", "v1", credentials=credentials)
    message = _build_message(
        sender_name=str(pdata.get("full_name") or ""),
        to_email=to_email,
        subject=subject,
        body=body,
        cv_content=cv_bytes,
        cv_filename=cv_name,
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
        token=token_data.get("access_token") or token_data.get("token"),
        refresh_token=token_data.get("refresh_token"),
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
    )


def _build_message(
    sender_name: str,
    to_email: str,
    subject: str,
    body: str,
    cv_content: Optional[bytes] = None,
    cv_filename: Optional[str] = None,
) -> str:
    """Construit un email MIME encodé en base64 pour l'API Gmail."""
    msg = MIMEMultipart()
    msg["To"] = to_email
    msg["Subject"] = subject

    if sender_name:
        msg["From"] = sender_name

    # Corps du message en HTML (paragraphes si texte brut)
    html_body = _plain_text_to_html_body(body)
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    # Pièce jointe CV si fournie
    if cv_content and cv_filename:
        attachment = MIMEApplication(cv_content, Name=cv_filename)
        attachment["Content-Disposition"] = f'attachment; filename="{cv_filename}"'
        msg.attach(attachment)

    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
    return raw
