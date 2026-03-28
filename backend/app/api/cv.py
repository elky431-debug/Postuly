"""Routes pour l'upload et l'analyse de CV."""

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.api.deps import CurrentUser
from app.db.client import get_supabase_admin
from app.services.cv_parser import parse_cv, score_cv

router = APIRouter()

ALLOWED_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
MAX_SIZE_MB = 10


@router.post("/upload")
async def upload_cv(user: CurrentUser, file: UploadFile = File(...)) -> dict:
    """Upload un CV (PDF ou DOCX), le parse et calcule un score."""
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Format non supporté. Utilisez PDF ou DOCX.",
        )

    content = await file.read()
    size_mb = len(content) / (1024 * 1024)

    if size_mb > MAX_SIZE_MB:
        raise HTTPException(
            status_code=400,
            detail=f"Fichier trop volumineux ({size_mb:.1f} Mo). Maximum : {MAX_SIZE_MB} Mo.",
        )

    supabase = get_supabase_admin()

    # Upload vers Supabase Storage
    file_path = f"cvs/{user['id']}/{file.filename}"
    supabase.storage.from_("cvs").upload(
        file_path,
        content,
        {"content-type": file.content_type},
    )
    cv_url = supabase.storage.from_("cvs").get_public_url(file_path)

    # Parser le CV
    parsed_data = await parse_cv(content, file.content_type)
    cv_score_value = score_cv(parsed_data)

    # Mettre à jour le profil
    supabase.table("profiles").update({
        "cv_url": cv_url,
        "cv_parsed": parsed_data,
        "cv_score": cv_score_value,
    }).eq("id", user["id"]).execute()

    return {
        "cv_url": cv_url,
        "parsed": parsed_data,
        "score": cv_score_value,
        "suggestions": _get_suggestions(parsed_data, cv_score_value),
    }


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
        suggestions.append("Votre CV manque d'éléments clés — enrichissez-le avant de lancer des candidatures")

    return suggestions
