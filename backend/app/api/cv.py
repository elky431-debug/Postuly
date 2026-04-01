"""Routes pour l'upload et l'analyse de CV."""

import json
import logging
import uuid
from typing import Any, Optional

from fastapi import APIRouter, File, HTTPException, UploadFile
from postgrest.exceptions import APIError
from storage3.exceptions import StorageApiError

from app.api.deps import CurrentUser
from app.config import get_settings
from app.db.client import get_supabase_admin
from app.models.schemas import CvCoachAnalyzeRequest
from app.services.cv_coach_analysis import analyze_cv_coach
from app.services.cv_media import resolve_cv_media_type
from app.services.cv_parser import parse_cv, score_cv

router = APIRouter()
logger = logging.getLogger(__name__)

MAX_SIZE_MB = 10


@router.post("/upload")
async def upload_cv(user: CurrentUser, file: UploadFile = File(...)) -> dict:
    """Upload un CV (PDF ou DOCX), le parse et calcule un score."""
    settings = get_settings()
    if not settings.supabase_url.strip() or not settings.supabase_service_role_key.strip():
        raise HTTPException(
            status_code=503,
            detail=(
                "Supabase non configuré : SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY "
                "requis dans backend/.env"
            ),
        )

    media = resolve_cv_media_type(file.content_type, file.filename)
    if media is None:
        raise HTTPException(
            status_code=400,
            detail="Format non supporté. Utilisez un fichier PDF ou DOCX.",
        )

    content = await file.read()
    size_mb = len(content) / (1024 * 1024)

    if size_mb > MAX_SIZE_MB:
        raise HTTPException(
            status_code=400,
            detail=f"Fichier trop volumineux ({size_mb:.1f} Mo). Maximum : {MAX_SIZE_MB} Mo.",
        )

    supabase = get_supabase_admin()

    ext = ".pdf" if media == "application/pdf" else ".docx"
    file_path = f"{user['id']}/{uuid.uuid4()}{ext}"

    # Stockage obligatoire : sinon cv_url reste NULL et les mails ne peuvent pas joindre le PDF.
    try:
        supabase.storage.from_("cvs").upload(
            file_path,
            content,
            file_options={
                "content-type": media,
                "upsert": "true",
            },
        )
        cv_url = supabase.storage.from_("cvs").get_public_url(file_path)
    except StorageApiError as e:
        logger.warning("Upload Storage « cvs » refusé : %s", e.message)
        raise HTTPException(
            status_code=503,
            detail=(
                "Supabase Storage indisponible ou bucket « cvs » manquant. "
                "Dans Supabase → SQL Editor, exécute le script backend/app/db/storage_cvs.sql "
                f"(puis réessaie). Détail : {e.message}"
            ),
        ) from e
    except Exception as e:
        logger.exception("Upload Storage CV inattendu")
        raise HTTPException(
            status_code=503,
            detail=(
                "Erreur lors de l’envoi du fichier vers Supabase Storage. "
                "Vérifie SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY et l’existence du bucket « cvs »."
            ),
        ) from e

    if not cv_url or not str(cv_url).strip().startswith("http"):
        raise HTTPException(
            status_code=503,
            detail="Storage a répondu sans URL publique valide pour le CV — vérifie la config du bucket « cvs ».",
        )

    try:
        parsed_data = await parse_cv(content, media)
    except Exception:
        try:
            supabase.storage.from_("cvs").remove([file_path])
        except StorageApiError:
            logger.warning("Suppression fichier CV après échec parse ignorée")
        logger.exception("parse_cv failed")
        raise HTTPException(
            status_code=422,
            detail="Impossible de lire ce PDF ou DOCX (fichier corrompu ou protégé ?).",
        ) from None

    cv_score_value = score_cv(parsed_data)

    update_row: dict = {
        "cv_url": cv_url,
        "cv_parsed": parsed_data,
        "cv_score": cv_score_value,
    }

    try:
        uid = user["id"]
        res = supabase.table("profiles").update(update_row).eq("id", uid).execute()
        # Pas de ligne (profil jamais créé) : insertion minimale
        if not res.data:
            supabase.table("profiles").insert({"id": uid, **update_row}).execute()
    except APIError as e:
        if e.code == "PGRST205" or (
            e.message and "could not find the table" in e.message.lower()
        ):
            raise HTTPException(
                status_code=503,
                detail=(
                    "Table « profiles » introuvable : exécute backend/app/db/schema.sql "
                    "dans Supabase → SQL Editor."
                ),
            ) from e
        logger.exception("profiles.update/insert après CV (APIError)")
        raise HTTPException(
            status_code=502,
            detail=e.message or "Erreur Supabase à l’enregistrement du CV.",
        ) from e
    except Exception as e:
        logger.exception("profiles.update/insert après CV")
        raise HTTPException(
            status_code=500,
            detail="Impossible d'enregistrer le CV sur le profil. Vérifie Supabase (table profiles, trigger).",
        ) from e

    return {
        "cv_url": cv_url or "",
        "parsed": parsed_data,
        "score": cv_score_value,
        "suggestions": _get_suggestions(parsed_data, cv_score_value),
    }


@router.post("/parse-only")
async def parse_cv_only(user: CurrentUser, file: UploadFile = File(...)) -> dict:
    """
    Analyse le fichier (PDF/DOCX) et met à jour cv_parsed + cv_score.
    Le fichier est déjà sur Supabase Storage (route Next /api/cv/upload) : cette route ne refait pas l’upload.
    """
    settings = get_settings()
    if not settings.supabase_url.strip() or not settings.supabase_service_role_key.strip():
        raise HTTPException(
            status_code=503,
            detail=(
                "Supabase non configuré : SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY "
                "requis dans backend/.env"
            ),
        )

    media = resolve_cv_media_type(file.content_type, file.filename)
    if media is None:
        raise HTTPException(
            status_code=400,
            detail="Format non supporté. Utilisez un fichier PDF ou DOCX.",
        )

    content = await file.read()
    size_mb = len(content) / (1024 * 1024)
    if size_mb > MAX_SIZE_MB:
        raise HTTPException(
            status_code=400,
            detail=f"Fichier trop volumineux ({size_mb:.1f} Mo). Maximum : {MAX_SIZE_MB} Mo.",
        )

    try:
        parsed_data = await parse_cv(content, media)
    except Exception:
        logger.exception("parse_cv failed (parse-only)")
        raise HTTPException(
            status_code=422,
            detail="Impossible de lire ce PDF ou DOCX (fichier corrompu ou protégé ?).",
        ) from None

    cv_score_value = score_cv(parsed_data)
    supabase = get_supabase_admin()
    uid = user["id"]
    update_row: dict = {
        "cv_parsed": parsed_data,
        "cv_score": cv_score_value,
    }

    try:
        res = supabase.table("profiles").update(update_row).eq("id", uid).execute()
        if not res.data:
            supabase.table("profiles").insert({"id": uid, **update_row}).execute()
    except APIError as e:
        if e.code == "PGRST205" or (
            e.message and "could not find the table" in e.message.lower()
        ):
            raise HTTPException(
                status_code=503,
                detail=(
                    "Table « profiles » introuvable : exécute backend/app/db/schema.sql "
                    "dans Supabase → SQL Editor."
                ),
            ) from e
        logger.exception("profiles update parse-only")
        raise HTTPException(
            status_code=502,
            detail=e.message or "Erreur Supabase à l’enregistrement du parsing.",
        ) from e

    return {
        "parsed": parsed_data,
        "score": cv_score_value,
        "suggestions": _get_suggestions(parsed_data, cv_score_value),
    }


@router.post("/analyse-coach")
async def analyse_cv_coach_route(
    user: CurrentUser,
    body: CvCoachAnalyzeRequest,
) -> dict[str, Any]:
    """
    Analyse approfondie du CV (coach RH) via OpenAI.
    Utilise le CV parsé enregistré sur le profil + poste / contrat / profil (saisie ou campagne).
    """
    settings = get_settings()
    if not settings.supabase_url.strip() or not settings.supabase_service_role_key.strip():
        raise HTTPException(
            status_code=503,
            detail=(
                "Supabase non configuré : SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY "
                "requis dans backend/.env"
            ),
        )

    supabase = get_supabase_admin()
    try:
        prof = (
            supabase.table("profiles")
            .select("cv_parsed", "profile_type")
            .eq("id", user["id"])
            .single()
            .execute()
        )
    except APIError as e:
        if e.code == "PGRST205" or (
            e.message and "could not find the table" in e.message.lower()
        ):
            raise HTTPException(
                status_code=503,
                detail=(
                    "Table « profiles » introuvable : exécute backend/app/db/schema.sql "
                    "dans Supabase → SQL Editor."
                ),
            ) from e
        if e.code in ("PGRST116",) or (e.message and "0 rows" in e.message):
            raise HTTPException(
                status_code=404,
                detail="Profil non trouvé — termine l’onboarding ou envoie d’abord un CV.",
            ) from e
        logger.exception("profiles select analyse-coach")
        raise HTTPException(
            status_code=502,
            detail=e.message or "Erreur Supabase.",
        ) from e

    if not prof.data:
        raise HTTPException(status_code=404, detail="Profil non trouvé")

    cv_parsed = prof.data.get("cv_parsed")
    if isinstance(cv_parsed, str):
        try:
            cv_parsed = json.loads(cv_parsed)
        except json.JSONDecodeError:
            cv_parsed = None
    if not cv_parsed or not isinstance(cv_parsed, dict):
        raise HTTPException(
            status_code=400,
            detail="Aucun CV parsé — envoie d’abord un PDF ou DOCX depuis Mon CV.",
        )

    profile_type: Optional[str] = prof.data.get("profile_type")

    poste = (body.poste_recherche or "").strip()
    type_contrat: Optional[str] = body.type_contrat
    profil_override = body.profil_hint

    if not poste or not type_contrat:
        try:
            camp_res = (
                supabase.table("campaigns")
                .select("job_title", "contract_type")
                .eq("user_id", user["id"])
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
            if camp_res.data:
                row = camp_res.data[0]
                if not poste and row.get("job_title"):
                    poste = str(row["job_title"]).strip()
                if not type_contrat and row.get("contract_type"):
                    type_contrat = str(row["contract_type"])
        except APIError:
            logger.warning("campaigns fetch pour analyse-coach ignoré")

    if not poste:
        poste = "Non précisé"
    if not type_contrat:
        type_contrat = None

    try:
        analyse = await analyze_cv_coach(
            cv_parsed=cv_parsed,
            poste_recherche=poste,
            type_contrat_code=type_contrat,
            profile_type=profile_type,
            profil_override=profil_override,
        )
    except ValueError as e:
        msg = str(e)
        if "OPENAI_API_KEY" in msg:
            raise HTTPException(
                status_code=503,
                detail="Analyse IA indisponible : renseigne OPENAI_API_KEY dans backend/.env.",
            ) from e
        raise HTTPException(status_code=502, detail=msg) from e

    return {"analyse": analyse}


def _get_suggestions(parsed: dict, score: int) -> list[str]:
    """Génère des suggestions d'amélioration du CV basées sur le parsing."""
    suggestions: list[str] = []

    if not parsed.get("experiences"):
        suggestions.append("Ajoutez vos expériences professionnelles ou stages")
    if not parsed.get("education"):
        suggestions.append("Précisez votre formation et diplômes")
    if not parsed.get("skills") or len(parsed.get("skills", [])) < 3:
        suggestions.append("Listez davantage de compétences techniques et soft skills")
    if not parsed.get("email"):
        suggestions.append("Vérifiez que votre email est bien visible sur le CV")
    if not parsed.get("phone"):
        suggestions.append("Ajoutez un numéro de téléphone")
    if score < 60:
        suggestions.append(
            "Votre CV manque d'éléments clés — enrichissez-le avant de lancer des candidatures"
        )

    return suggestions
