"""Service de génération de lettres de motivation par IA."""

from app.config import get_settings


async def generate_cover_letter(
    user_profile: dict,
    company: dict,
    job_title: str,
    contract_type: str,
) -> dict:
    """
    Génère une lettre de motivation personnalisée.
    Utilise Claude (Anthropic) en priorité, fallback sur OpenAI.
    """
    settings = get_settings()

    prompt = _build_prompt(user_profile, company, job_title, contract_type)

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
- Ville : {city}

## Ton attendu selon le contrat
- stage : enthousiaste et motivé, style étudiant sérieux, focus sur l'apprentissage
- alternance : dynamique et concret, met en avant le rythme école/entreprise et les compétences en développement
- CDI : professionnel et confiant, focus sur la valeur ajoutée immédiate et la projection long terme
- CDD : réactif et opérationnel, disponibilité et adaptabilité mises en avant

## Instructions
- Adopte le ton correspondant au type de contrat ci-dessus
- Structure : accroche (1 phrase marquante) → pourquoi cette entreprise → ce que le candidat apporte → conclusion + appel à action
- Longueur : 3 paragraphes, max 250 mots
- Langue : français, vouvoiement
- NE PAS inventer de détails absents du profil
- NE PAS utiliser de formules bateau ("Je me permets de vous adresser ma candidature...")
- Terminer par une formule de politesse sobre
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

    text = response.choices[0].message.content
    tokens = response.usage.total_tokens if response.usage else None

    return {"cover_letter": text, "tokens_used": tokens}
