"""Service de génération de lettres de motivation par IA."""

import re
from typing import Optional

from app.config import get_settings


def normalize_cover_letter_spacing(text: str) -> str:
    """
    Renforce les sauts de ligne si le modèle les a omis (évite un bloc sans structure).
    """
    t = text.strip()
    if not t:
        return t
    if "\n\n" in t:
        return t
    t = re.sub(r"(?i)(Monsieur,\s*Madame,)\s+", r"\1\n\n", t, count=1)
    t = re.sub(
        r"(?<!\n)\s+(Cordialement|Bien cordialement|Bien à vous)\b",
        r"\n\n\1",
        t,
        count=1,
        flags=re.IGNORECASE,
    )
    return t


async def generate_cover_letter(
    user_profile: dict,
    company: dict,
    job_title: str,
    contract_type: str,
    contract_start_date: Optional[str] = None,
    contract_end_date: Optional[str] = None,
) -> dict:
    """
    Génère une lettre de motivation personnalisée.
    Utilise Claude (Anthropic) en priorité, fallback sur OpenAI.
    """
    settings = get_settings()

    prompt = _build_prompt(
        user_profile,
        company,
        job_title,
        contract_type,
        contract_start_date=contract_start_date,
        contract_end_date=contract_end_date,
    )

    if settings.anthropic_api_key:
        return await _generate_with_anthropic(prompt, settings.anthropic_api_key)
    elif settings.openai_api_key:
        return await _generate_with_openai(prompt, settings.openai_api_key)
    else:
        raise ValueError("Aucune clé API IA configurée (ANTHROPIC_API_KEY ou OPENAI_API_KEY)")


def _build_prompt(
    user_profile: dict,
    company: dict,
    job_title: str,
    contract_type: str,
    contract_start_date: Optional[str] = None,
    contract_end_date: Optional[str] = None,
) -> str:
    """Construit le prompt de génération selon la charte produit."""
    cv_parsed = user_profile.get("cv_parsed", {})
    full_name = (user_profile.get("full_name") or "").strip()
    if full_name:
        parts = full_name.split()
        first_name = parts[0]
        last_name = " ".join(parts[1:]) if len(parts) > 1 else ""
    else:
        first_name = "Candidat"
        last_name = ""

    email = (
        user_profile.get("email")
        or cv_parsed.get("email")
        or "non spécifié"
    )
    experiences = "\n".join(cv_parsed.get("experiences", [])[:6]) or "non spécifiées"
    formations = "\n".join(cv_parsed.get("education", [])[:6]) or "non spécifiées"
    skills = ", ".join(cv_parsed.get("skills", [])[:12]) or "non spécifiées"
    languages = ", ".join(cv_parsed.get("languages", [])[:8]) or "non spécifiées"

    company_name = company.get("name") or "Entreprise"
    company_sector = company.get("naf_label") or company.get("naf_code") or "non spécifié"
    city = company.get("city") or "non spécifiée"

    periode = "non précisée"
    if contract_start_date and contract_end_date:
        periode = f"du {contract_start_date} au {contract_end_date}"
    elif contract_start_date:
        periode = f"à partir du {contract_start_date}"
    elif contract_end_date:
        periode = f"jusqu'au {contract_end_date}"

    contrat_dates = ""
    if contract_type.strip().upper() == "CDI":
        contrat_dates = (
            "- Pour un CDI : ne mentionne pas de dates de début/fin ni de durée inventée ; "
            "indique clairement qu’il s’agit d’un CDI."
        )
    else:
        contrat_dates = (
            f"- Le type de contrat « {contract_type} » et la période « {periode} » doivent apparaître "
            "clairement dans le corps de la lettre (formulation naturelle, pas une liste)."
        )

    return f"""Tu es un expert en recrutement français. Tu rédiges des lettres de motivation percutantes, naturelles et personnalisées.

## Profil du candidat
- Nom : {first_name} {last_name}
- Email : {email}
- Expériences :
{experiences}
- Formations :
{formations}
- Compétences : {skills}
- Langues : {languages}

## Candidature
- Entreprise : {company_name}
- Secteur : {company_sector}
- Poste visé : {job_title}
- Type de contrat : {contract_type}
- Période souhaitée : {periode}
- Ville : {city}

## Ton attendu selon le contrat
- stage : enthousiaste et motivé, style étudiant sérieux, focus sur l'apprentissage
- alternance : dynamique et concret, met en avant le rythme école/entreprise et les compétences en développement
- CDI : professionnel et confiant, focus sur la valeur ajoutée immédiate et la projection long terme
- CDD : réactif et opérationnel, disponibilité et adaptabilité mises en avant

## Format obligatoire (texte brut, pour un rendu e-mail lisible)
- Première ligne exactement : Monsieur, Madame,
- Puis une ligne vide, puis le corps en exactement 3 paragraphes distincts.
- Entre chaque paragraphe du corps : une ligne vide (double saut de ligne \\n\\n).
- Après le 3e paragraphe : une ligne vide, puis la formule de politesse (ex. Cordialement,) puis ton prénom et nom sur la ligne suivante si pertinent.
{contrat_dates}
- NE PAS utiliser de HTML, de markdown ni de numérotation de paragraphes.

## Instructions de fond
- Adopte le ton correspondant au type de contrat ci-dessus
- Structure du contenu : accroche → pourquoi cette entreprise → ce que le candidat apporte → conclusion
- Longueur : max 250 mots
- Langue : français, vouvoiement
- NE PAS inventer de détails absents du profil
- NE PAS utiliser de formules bateau ("Je me permets de vous adresser ma candidature...")
- Retourner UNIQUEMENT la lettre, sans commentaire ni balise

Rédige maintenant la lettre de motivation."""


async def _generate_with_anthropic(prompt: str, api_key: str) -> dict:
    """Génère via l'API Claude d'Anthropic."""
    import anthropic

    client = anthropic.AsyncAnthropic(api_key=api_key)

    response = await client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )

    text = response.content[0].text
    tokens = response.usage.input_tokens + response.usage.output_tokens

    return {"cover_letter": text, "tokens_used": tokens}


async def _generate_with_openai(prompt: str, api_key: str) -> dict:
    """Génère via l'API OpenAI (GPT-4o-mini)."""
    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=api_key)

    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "Tu es un expert en rédaction de lettres de motivation en français."},
            {"role": "user", "content": prompt},
        ],
        max_tokens=1024,
        temperature=0.7,
    )

    raw = response.choices[0].message.content or ""
    text = normalize_cover_letter_spacing(raw)
    tokens = response.usage.total_tokens if response.usage else None

    return {"cover_letter": text, "tokens_used": tokens}
