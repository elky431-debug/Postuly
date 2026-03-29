"""Routes pour la gestion des profils utilisateurs."""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from postgrest.exceptions import APIError

from app.api.deps import CurrentUser
from app.config import get_settings
from app.db.client import get_supabase_admin
from app.models.schemas import ProfileResponse, ProfileUpdate

router = APIRouter()
logger = logging.getLogger(__name__)


def _cv_storage_path_from_public_url(url: str) -> Optional[str]:
    """Extrait le chemin bucket « cvs » depuis une URL publique Supabase."""
    marker = "/cvs/"
    if marker not in url:
        return None
    path = url.split(marker, 1)[1].split("?", 1)[0].strip()
    return path or None


@router.get("/me", response_model=ProfileResponse)
async def get_my_profile(user: CurrentUser) -> dict:
    """Récupère le profil de l'utilisateur connecté."""
    settings = get_settings()
    if not settings.supabase_url.strip() or not settings.supabase_service_role_key.strip():
        raise HTTPException(
            status_code=503,
            detail=(
                "Supabase non configuré côté serveur : renseigne SUPABASE_URL et "
                "SUPABASE_SERVICE_ROLE_KEY dans backend/.env puis redémarre uvicorn."
            ),
        )

    supabase = get_supabase_admin()
    try:
        response = (
            supabase.table("profiles").select("*").eq("id", user["id"]).single().execute()
        )
    except APIError as e:
        # Table absente du projet (schéma jamais appliqué)
        if e.code == "PGRST205" or (
            e.message and "could not find the table" in e.message.lower()
        ):
            raise HTTPException(
                status_code=503,
                detail=(
                    "La base Supabase n’a pas les tables Postuly. Va dans Supabase → SQL Editor, "
                    "ouvre le fichier backend/app/db/schema.sql du projet, colle tout le script et "
                    "clique sur Run."
                ),
            ) from e
        # Aucune ligne : code PostgREST courant
        if e.code in ("PGRST116",) or (e.message and "0 rows" in e.message):
            raise HTTPException(status_code=404, detail="Profil non trouvé") from e
        logger.warning("Supabase profiles/me : %s", e)
        raise HTTPException(
            status_code=502,
            detail=e.message or "Erreur Supabase (vérifie le schéma SQL et les clés .env).",
        ) from e
    except Exception as e:
        logger.exception("profiles/me")
        raise HTTPException(
            status_code=502,
            detail="Impossible de contacter Supabase. Vérifie backend/.env et le réseau.",
        ) from e

    if not response.data:
        raise HTTPException(status_code=404, detail="Profil non trouvé")

    return response.data


@router.patch("/me", response_model=ProfileResponse)
async def update_my_profile(body: ProfileUpdate, user: CurrentUser) -> dict:
    """Met à jour le profil (type, nom)."""
    supabase = get_supabase_admin()
    update_data = body.model_dump(exclude_unset=True)

    if not update_data:
        raise HTTPException(status_code=400, detail="Aucune donnée à mettre à jour")

    old_cv_url: Optional[str] = None
    if update_data.get("cv_url") is None and "cv_url" in update_data:
        try:
            prev = (
                supabase.table("profiles")
                .select("cv_url")
                .eq("id", user["id"])
                .single()
                .execute()
            )
            if prev.data and isinstance(prev.data.get("cv_url"), str):
                old_cv_url = prev.data["cv_url"]
        except Exception:
            logger.warning("profiles/me PATCH : lecture cv_url avant suppression impossible")

    response = (
        supabase.table("profiles")
        .update(update_data)
        .eq("id", user["id"])
        .execute()
    )

    if not response.data:
        raise HTTPException(status_code=404, detail="Profil non trouvé")

    if old_cv_url:
        path = _cv_storage_path_from_public_url(old_cv_url)
        if path:
            try:
                supabase.storage.from_("cvs").remove([path])
            except Exception as e:
                logger.warning("Suppression storage CV ignorée (%s) : %s", path, e)

    return response.data[0]
