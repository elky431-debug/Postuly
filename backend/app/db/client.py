from supabase import create_client, Client
from fastapi import HTTPException

from app.config import get_settings


def get_supabase_client() -> Client:
    """Client Supabase avec la clé anon (pour les requêtes authentifiées côté user)."""
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_anon_key)


def get_supabase_admin() -> Client:
    """Client Supabase avec la clé service_role (pour les opérations admin/backend)."""
    settings = get_settings()
    url = (settings.supabase_url or "").strip()
    key = (settings.supabase_service_role_key or "").strip()
    if not url or not key:
        raise HTTPException(
            status_code=503,
            detail=(
                "backend/.env : SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis "
                "(clé « service_role » du projet Supabase, pas l’anon)."
            ),
        )
    return create_client(url, key)
