"""Routes pour la gestion des profils utilisateurs."""

import logging
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from postgrest.exceptions import APIError
from pydantic import ValidationError

from app.api.deps import CurrentUser
from app.config import get_settings
from app.db.client import get_supabase_admin
from app.models.schemas import ProfileResponse, ProfileUpdate

router = APIRouter()
logger = logging.getLogger(__name__)


def _row_as_dict(data: Any) -> Optional[dict[str, Any]]:
    """Normalise la réponse PostgREST (.single() = dict, rarement une liste d’un élément)."""
    if data is None:
        return None
    if isinstance(data, dict):
        return data
    if isinstance(data, list) and len(data) == 1 and isinstance(data[0], dict):
        return data[0]
    return None


def _profile_from_supabase_or_502(raw: Any, user_id: str) -> ProfileResponse:
    """Valide explicitement pour éviter un 500 « Internal Server Error » côté FastAPI."""
    row = _row_as_dict(raw)
    if not row:
        raise HTTPException(status_code=404, detail="Profil non trouvé")
    try:
        return ProfileResponse.model_validate(row)
    except ValidationError as e:
        logger.error(
            "Profil %s : données Supabase incompatibles avec ProfileResponse — %s",
            user_id,
            e.errors(),
        )
        raise HTTPException(
            status_code=502,
            detail=(
                "Les colonnes du profil en base ne correspondent pas au format attendu "
                "(ex. cv_parsed JSONB invalide). Consulte les logs uvicorn pour le détail Pydantic."
            ),
        ) from e


def _cv_storage_path_from_public_url(url: str) -> Optional[str]:
    """Extrait le chemin bucket « cvs » depuis une URL publique Supabase."""
    marker = "/cvs/"
    if marker not in url:
        return None
    path = url.split(marker, 1)[1].split("?", 1)[0].strip()
    return path or None


@router.get("/me", response_model=ProfileResponse)
async def get_my_profile(user: CurrentUser) -> ProfileResponse:
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
    uid = user["id"]

    def _fetch() -> Any:
        return (
            supabase.table("profiles").select("*").eq("id", uid).single().execute()
        )

    try:
        response = _fetch()
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
        # Aucune ligne : créer le profil si le trigger auth n’a pas tourné
        if e.code in ("PGRST116",) or (e.message and "0 rows" in e.message):
            try:
                supabase.table("profiles").insert({"id": uid, "full_name": None}).execute()
                logger.info("Profil créé automatiquement pour l’utilisateur %s", uid)
            except APIError as ins_err:
                msg = (ins_err.message or "").lower()
                if "duplicate" in msg or "unique" in msg or ins_err.code == "23505":
                    pass  # une autre requête a créé la ligne : on relit
                else:
                    logger.warning("profiles/me insert auto : %s", ins_err)
                    raise HTTPException(
                        status_code=404,
                        detail="Profil non trouvé. Réessaie après t’être reconnecté ou exécute le schéma SQL.",
                    ) from ins_err
            try:
                response = _fetch()
            except APIError as e2:
                logger.warning("profiles/me après insert : %s", e2)
                raise HTTPException(
                    status_code=404, detail="Profil non trouvé après création."
                ) from e2
        else:
            logger.warning("Supabase profiles/me : %s", e)
            raise HTTPException(
                status_code=502,
                detail=e.message or "Erreur Supabase (vérifie le schéma SQL et les clés .env).",
            ) from e
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("profiles/me")
        raise HTTPException(
            status_code=502,
            detail="Impossible de contacter Supabase. Vérifie backend/.env et le réseau.",
        ) from e

    return _profile_from_supabase_or_502(response.data, uid)


@router.patch("/me", response_model=ProfileResponse)
async def update_my_profile(body: ProfileUpdate, user: CurrentUser) -> ProfileResponse:
    """Met à jour le profil (type, nom)."""
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

    return _profile_from_supabase_or_502(response.data[0], user["id"])
