"""Diagnostic local (sans auth) — vérifie .env + accès Supabase."""

from urllib.parse import urlparse

from fastapi import APIRouter
from postgrest.exceptions import APIError

from app.config import get_settings
from app.db.client import get_supabase_admin

router = APIRouter()


@router.get("/supabase")
async def diagnostic_supabase() -> dict:
    """
    À appeler depuis le navigateur ou curl : GET /api/diagnostic/supabase
    Ne renvoie jamais de clé secrète — seulement si la config a l’air cohérente.
    """
    s = get_settings()
    url = (s.supabase_url or "").strip()
    parsed = urlparse(url) if url else None
    host = parsed.netloc if parsed else ""

    out: dict = {
        "supabase_url_configured": bool(url),
        "supabase_host": host or None,
        "anon_key_configured": bool((s.supabase_anon_key or "").strip()),
        "service_role_configured": bool((s.supabase_service_role_key or "").strip()),
        "profiles_query": None,
    }

    if not url or not (s.supabase_service_role_key or "").strip():
        out["profiles_query"] = "skip — URL ou SUPABASE_SERVICE_ROLE_KEY manquant"
        return out

    try:
        supabase = get_supabase_admin()
        r = supabase.table("profiles").select("id").limit(1).execute()
        out["profiles_query"] = "ok" if r.data is not None else "ok (réponse vide)"
    except APIError as e:
        if e.code == "PGRST205":
            out["profiles_query"] = (
                "PGRST205 : table « profiles » absente — exécute backend/app/db/schema.sql "
                "dans Supabase → SQL Editor"
            )
        else:
            out["profiles_query"] = f"erreur API Supabase : {e.message or e.code or str(e)}"
    except Exception as e:
        out["profiles_query"] = f"erreur : {type(e).__name__}: {e!s}"

    return out
