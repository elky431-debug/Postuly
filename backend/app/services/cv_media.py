"""Détection PDF/DOCX (navigateurs envoient parfois un MIME vide ou incorrect)."""

from typing import Optional

DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

ALLOWED_CV_MEDIA_TYPES = frozenset(
    {
        "application/pdf",
        DOCX,
    }
)


def resolve_cv_media_type(
    content_type: Optional[str], filename: Optional[str]
) -> Optional[str]:
    """
    Retourne un MIME autorisé ou None.
    Gère Safari, application/octet-stream, doubles extensions (.pdf.pdf), etc.
    """
    ct = (content_type or "").strip()
    if ct in ALLOWED_CV_MEDIA_TYPES:
        return ct

    name = (filename or "").lower()
    ct_lower = ct.lower()

    if ct_lower in ("application/octet-stream", "binary/octet-stream", ""):
        if name.endswith(".pdf"):
            return "application/pdf"
        if name.endswith(".docx"):
            return DOCX

    if name.endswith(".pdf"):
        return "application/pdf"
    if name.endswith(".docx"):
        return DOCX

    return None
