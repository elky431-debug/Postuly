"""Modèles Pydantic pour la validation des données API."""

import json
from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


# ─── Profiles ────────────────────────────────────────────

class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    profile_type: Optional[str] = Field(None, pattern="^(etudiant|jeune_actif)$")
    # Formulaire Mon CV (extraction IA + édition utilisateur)
    cv_parsed: Optional[dict[str, Any]] = None
    cv_url: Optional[str] = None
    cv_score: Optional[int] = None

    @field_validator("cv_score", mode="before")
    @classmethod
    def coerce_cv_score_update(cls, v: object) -> Optional[int]:
        if v is None:
            return None
        return int(round(float(v)))


class ProfileResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: UUID
    full_name: Optional[str] = None
    profile_type: Optional[str] = None
    cv_url: Optional[str] = None
    cv_parsed: Optional[dict[str, Any]] = None
    cv_score: Optional[int] = None
    created_at: Optional[datetime] = None

    @field_validator("full_name", mode="before")
    @classmethod
    def coerce_full_name(cls, v: object) -> Optional[str]:
        if v is None:
            return None
        s = str(v).strip()
        return s if s else None

    @field_validator("profile_type", mode="before")
    @classmethod
    def coerce_profile_type_read(cls, v: object) -> Optional[str]:
        """Neutralise les valeurs hors schéma plutôt qu’un échec de sérialisation API."""
        if v is None or v == "":
            return None
        s = str(v).strip()
        if s in ("etudiant", "jeune_actif"):
            return s
        return None

    @field_validator("cv_url", mode="before")
    @classmethod
    def coerce_cv_url(cls, v: object) -> Optional[str]:
        if v is None or v == "":
            return None
        s = str(v).strip()
        return s if s else None

    @field_validator("cv_score", mode="before")
    @classmethod
    def coerce_cv_score(cls, v: object) -> Optional[int]:
        if v is None:
            return None
        return int(round(float(v)))

    @field_validator("cv_parsed", mode="before")
    @classmethod
    def coerce_cv_parsed(cls, v: object) -> Optional[dict[str, Any]]:
        if v is None:
            return None
        if isinstance(v, dict):
            return v
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
                return parsed if isinstance(parsed, dict) else None
            except json.JSONDecodeError:
                return None
        return None

    @field_validator("created_at", mode="before")
    @classmethod
    def coerce_created_at(cls, v: object) -> Optional[datetime]:
        if v is None or v == "":
            return None
        if isinstance(v, datetime):
            return v
        s = str(v).strip().replace("Z", "+00:00")
        try:
            return datetime.fromisoformat(s)
        except ValueError:
            try:
                return datetime.fromisoformat(str(v).strip().replace("Z", ""))
            except ValueError:
                return None


# ─── Analyse coach CV (IA) ────────────────────────────────

class CvCoachAnalyzeRequest(BaseModel):
    """Paramètres optionnels pour contextualiser l’analyse IA du CV."""

    poste_recherche: Optional[str] = Field(None, max_length=400)
    type_contrat: Optional[str] = Field(None, pattern="^(stage|alternance|cdi|cdd)$")
    profil_hint: Optional[str] = Field(
        None,
        pattern="^(etudiant|jeune_actif|reconversion)$",
    )


# ─── Campaigns ───────────────────────────────────────────

class CampaignCreate(BaseModel):
    job_title: str = Field(..., min_length=2, max_length=200)
    location: str = Field(..., min_length=2, max_length=200)
    radius_km: int = Field(default=30, ge=5, le=200)
    contract_type: str = Field(..., pattern="^(stage|alternance|cdi|cdd)$")


class CampaignUpdate(BaseModel):
    job_title: Optional[str] = None
    location: Optional[str] = None
    radius_km: Optional[int] = Field(None, ge=5, le=200)
    contract_type: Optional[str] = Field(None, pattern="^(stage|alternance|cdi|cdd)$")
    status: Optional[str] = Field(None, pattern="^(draft|running|paused|completed)$")


class CampaignResponse(BaseModel):
    id: UUID
    user_id: UUID
    job_title: str
    location: str
    radius_km: int
    contract_type: str
    status: str
    created_at: datetime


# ─── Companies ───────────────────────────────────────────

class CompanyResponse(BaseModel):
    id: UUID
    siret: Optional[str] = None
    name: str
    address: Optional[str] = None
    city: Optional[str] = None
    postal_code: Optional[str] = None
    naf_code: Optional[str] = None
    naf_label: Optional[str] = None
    size_range: Optional[str] = None
    website_url: Optional[str] = None


class CompanySearchParams(BaseModel):
    location: str
    radius_km: int = 30
    naf_codes: Optional[list[str]] = None
    size_min: Optional[int] = None


# ─── Email Contacts ──────────────────────────────────────

class EmailContactResponse(BaseModel):
    id: UUID
    company_id: UUID
    email: str
    source: str
    verified: bool


# ─── Applications ────────────────────────────────────────


class CampaignBrief(BaseModel):
    """Champs campagne utiles au Kanban / prévisualisation."""

    job_title: str = ""
    contract_type: Optional[str] = None
    location: str = ""


class ApplicationResponse(BaseModel):
    id: UUID
    campaign_id: UUID
    company_id: Optional[UUID] = None
    contact_id: Optional[UUID] = None
    cover_letter: Optional[str] = None
    status: str
    sent_at: Optional[datetime] = None
    replied_at: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: datetime
    company: Optional[CompanyResponse] = None
    contact: Optional[EmailContactResponse] = None
    campaign: Optional[CampaignBrief] = None


class ApplicationUpdate(BaseModel):
    cover_letter: Optional[str] = None
    status: Optional[str] = Field(
        None,
        pattern="^(pending_review|approved|sent|followed_up|replied|interview|offer|rejected)$",
    )
    notes: Optional[str] = None


# ─── Cover Letter Generation ────────────────────────────

class CoverLetterRequest(BaseModel):
    company_name: str
    company_sector: Optional[str] = None
    company_size: Optional[str] = None
    job_title: str
    contract_type: str = Field(..., pattern="^(stage|alternance|cdi|cdd)$")


class CoverLetterResponse(BaseModel):
    cover_letter: str
    tokens_used: Optional[int] = None


# ─── Campaign Launch ────────────────────────────────────

class CampaignLaunchResponse(BaseModel):
    campaign_id: UUID
    companies_found: int
    emails_found: int
    applications_created: int
    message: str


# ─── Campagne depuis Ma sélection (entreprises + contacts déjà trouvés) ───────


class SelectionContactIn(BaseModel):
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    position: Optional[str] = None
    department: Optional[str] = None
    confidence: Optional[int] = Field(default=0, ge=0, le=100)


class SelectionDestinationIn(BaseModel):
    siret: str = Field(..., min_length=9)
    nom: str = Field(..., min_length=1)
    ville: str = ""
    code_postal: str = ""
    naf: str = ""
    libelle_naf: Optional[str] = None
    domaine: str = ""
    taille: str = ""
    contact: SelectionContactIn


class CampaignFromSelectionBody(BaseModel):
    """Crée une campagne + candidatures approuvées (lettres IA) pour n8n."""

    destinations: list[SelectionDestinationIn] = Field(..., min_length=1)
    job_title: Optional[str] = Field(None, max_length=200)
    location: Optional[str] = Field(None, max_length=200)
    contract_type: Optional[str] = Field(None, pattern="^(stage|alternance|cdi|cdd)$")
    contract_start_date: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    contract_end_date: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$")


class CampaignFromSelectionResponse(BaseModel):
    campaign_id: UUID
    applications_created: int
    message: str
