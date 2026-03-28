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
    """Construit le prompt adapté au type de contrat."""
    cv_parsed = user_profile.get("cv_parsed", {})
    profile_type = user_profile.get("profile_type", "jeune_actif")

    # Adapter le contexte au type de contrat
    context_map = {
        "stage": (
            "C'est une candidature pour un stage. "
            "Le ton doit être motivé et humble, mentionner la formation en cours, "
            "les dates souhaitées et la durée du stage."
        ),
        "alternance": (
            "C'est une candidature pour une alternance. "
            "Mentionner le rythme école/entreprise, la formation suivie, "
            "et montrer la motivation à apprendre en entreprise."
        ),
        "cdi": (
            "C'est une candidature pour un CDI. "
            "Le ton doit être professionnel et confiant, mettre en avant "
            "les expériences et compétences concrètes."
        ),
        "cdd": (
            "C'est une candidature pour un CDD. "
            "Montrer la disponibilité immédiate et l'adaptabilité, "
            "mettre en avant les compétences pertinentes."
        ),
    }

    contract_context = context_map.get(contract_type, context_map["cdi"])

    skills = ", ".join(cv_parsed.get("skills", [])[:10]) or "non spécifiées"
    experiences = "\n".join(cv_parsed.get("experiences", [])[:5]) or "non spécifiées"

    return f"""Tu es un expert en rédaction de lettres de motivation en français.
Génère une lettre de motivation professionnelle et personnalisée.

CONTEXTE :
{contract_context}

CANDIDAT :
- Nom : {user_profile.get('full_name', 'Candidat')}
- Profil : {profile_type}
- Compétences : {skills}
- Expériences :
{experiences}

ENTREPRISE CIBLE :
- Nom : {company.get('name', 'Entreprise')}
- Secteur (code NAF) : {company.get('naf_code', 'Non spécifié')} — {company.get('naf_label', '')}
- Taille : {company.get('size_range', 'Non spécifiée')}
- Ville : {company.get('city', 'Non spécifiée')}

POSTE VISÉ : {job_title}
TYPE DE CONTRAT : {contract_type.upper()}

INSTRUCTIONS :
1. La lettre doit faire 200-300 mots maximum
2. Personnaliser avec le nom de l'entreprise et son secteur d'activité
3. Mettre en valeur 2-3 compétences pertinentes du candidat
4. Adapter le ton au type de contrat
5. Structure : accroche → motivation → compétences → conclusion avec call-to-action
6. Ne PAS utiliser de formules bateau ("je me permets de vous écrire...")
7. Écrire directement la lettre, sans introduction ni explication

Écris uniquement la lettre, rien d'autre."""


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
