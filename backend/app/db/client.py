from supabase import create_client, Client
from app.config import get_settings


def get_supabase_client() -> Client:
    """Client Supabase avec la clé anon (pour les requêtes authentifiées côté user)."""
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_anon_key)


def get_supabase_admin() -> Client:
    """Client Supabase avec la clé service_role (pour les opérations admin/backend)."""
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_service_role_key)
