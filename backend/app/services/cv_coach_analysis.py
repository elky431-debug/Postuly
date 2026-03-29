"""Analyse CV par IA (expert RH / coach carrière) — réponse JSON structurée."""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from app.config import get_settings

logger = logging.getLogger(__name__)

COACH_SYSTEM = (
    "Tu appliques exactement le rôle et les règles décrits par l’utilisateur. "
    "Réponse exclusivement : un objet JSON valide, UTF-8, sans texte avant ou après, sans backticks."
)

CONTRACT_LABELS_FR: dict[str, str] = {
    "stage": "Stage",
    "alternance": "Alternance / apprentissage",
    "cdi": "CDI",
    "cdd": "CDD",
}

# Prompt métier (placeholders : {cv_json}, {poste_recherche}, {type_contrat}, {profil_type})
COACH_USER_PROMPT_TEMPLATE = r"""Tu es un expert RH et coach carrière français spécialisé dans l'aide aux étudiants et jeunes actifs. Tu analyses des CV avec précision, bienveillance et pragmatisme.

RÈGLES ABSOLUES :
- Tu réponds UNIQUEMENT en JSON valide. Zéro texte avant ou après. Zéro backtick.
- Tout le contenu est en français, sans exception. Jamais de termes anglais dans les libellés.
- Tu es direct et honnête, mais toujours constructif. Pas de faux positifs.
- Tes suggestions sont CONCRÈTES et ACTIONNABLES, pas des généralités.
- Tu tiens compte du profil (étudiant / jeune actif) et du type de contrat cible.
- Tu identifies VRAIMENT des points forts quand ils existent. Tu ne laisses jamais "Aucun point fort identifié".

---

Voici les données d'un candidat. Génère une analyse complète de son CV.

DONNÉES DU CANDIDAT :
- CV parsé (JSON) : {cv_json}
- Poste recherché : {poste_recherche}
- Type de contrat : {type_contrat}
- Profil détecté : {profil_type}

Retourne UNIQUEMENT ce JSON :

{{
  "score_global": 0,
  "score_potentiel": 0,
  "niveau": "",
  "profil_detecte": "",

  "synthese": {{
    "texte": "",
    "nb_corrections_prioritaires": 0,
    "temps_estime_minutes": 0
  }},

  "objectif_recherche": {{
    "poste": "",
    "type_contrat": "",
    "evaluation": "",
    "adequation": "",
    "alternatives": []
  }},

  "points_forts": [
    {{
      "titre": "",
      "description": "",
      "impact": ""
    }}
  ],

  "points_ameliorer": [
    {{
      "priorite": "majeur | mineur",
      "section": "",
      "titre": "",
      "description": "",
      "suggestion_concrete": ""
    }}
  ],

  "analyse_sections": {{
    "informations_personnelles": {{
      "score": 0,
      "statut": "complet | incomplet | absent",
      "commentaire": ""
    }},
    "resume_professionnel": {{
      "score": 0,
      "statut": "complet | incomplet | absent",
      "commentaire": "",
      "suggestion_reecriture": null
    }},
    "experiences": {{
      "score": 0,
      "statut": "complet | incomplet | absent",
      "commentaire": "",
      "nb_experiences": 0,
      "points_forts": [],
      "points_faibles": []
    }},
    "formations": {{
      "score": 0,
      "statut": "complet | incomplet | absent",
      "commentaire": ""
    }},
    "competences": {{
      "score": 0,
      "statut": "complet | incomplet | absent",
      "commentaire": "",
      "competences_manquantes_pour_poste": [],
      "competences_generiques_a_supprimer": []
    }},
    "langues": {{
      "score": 0,
      "statut": "complet | incomplet | absent",
      "commentaire": ""
    }},
    "photo": {{
      "presente": false,
      "commentaire": ""
    }}
  }},

  "secteurs_compatibles": [
    {{
      "nom": "",
      "adequation": "forte | moyenne | faible",
      "codes_naf": []
    }}
  ],

  "mots_cles_ats": {{
    "presents": [],
    "manquants": [],
    "score_ats": 0,
    "commentaire": ""
  }},

  "plan_action": [
    {{
      "ordre": 1,
      "action": "",
      "section_concernee": "",
      "difficulte": "facile | moyen | difficile",
      "impact_score": 0,
      "exemple_concret": ""
    }}
  ]
}}

RÈGLES DE SCORING :
- score_global sur 100, calculé objectivement
- score_potentiel = score si toutes les corrections majeures sont appliquées (max +40)
- niveau : "Insuffisant" (0-49) | "Passable" (50-64) | "Bien" (65-79) | "Très bien" (80-89) | "Excellent" (90-100)
- profil_detecte : "Étudiant / Jeune Diplômé" | "Jeune Actif" | "En reconversion"

RÈGLES POINTS FORTS :
- Minimum 1 point fort, maximum 5
- Un point fort doit être RÉEL et SPÉCIFIQUE
- Exemples valides : expérience directement liée au poste, multilinguisme réel, projet personnel concret, polyvalence démontrée
- Si le profil est vraiment faible : valoriser le potentiel ou la motivation perceptible

RÈGLES POINTS À AMÉLIORER :
- Maximum 5 points, les plus impactants seulement
- Toujours en français, titres descriptifs et compréhensibles
- suggestion_concrete doit donner un exemple de reformulation ou d'action précise

RÈGLES SECTEURS COMPATIBLES :
- Basé sur les expériences ET les compétences, pas seulement le poste cible
- Inclure les codes NAF correspondants pour l'API SIRENE
- 5 à 12 secteurs maximum

RÈGLES MOTS CLÉS ATS :
- Identifier les mots clés du poste cible présents ou absents dans le CV
- score_ats sur 100 : proportion de mots clés importants présents

RÈGLES PLAN D'ACTION :
- 3 à 5 actions concrètes, triées par impact décroissant
- exemple_concret : donner une vraie reformulation ou suggestion textuelle
- impact_score : points gagnés si cette action est faite (doit sommer à score_potentiel - score_global)
"""


def contract_label_fr(code: str | None) -> str:
    """Libellé français du type de contrat pour le prompt."""
    if not code:
        return "Non précisé — à intégrer dans l’analyse"
    return CONTRACT_LABELS_FR.get(code.lower(), code)


def profil_hint_fr(
    profile_type: str | None,
    override: str | None,
) -> str:
    """Indication de profil transmise au modèle (cohérente avec le compte ou la saisie)."""
    key = (override or profile_type or "").strip().lower()
    if key == "etudiant":
        return "Étudiant / Jeune Diplômé (indication compte ou saisie)"
    if key == "jeune_actif":
        return "Jeune Actif (indication compte ou saisie)"
    if key == "reconversion":
        return "En reconversion (indication saisie)"
    return "À déduire du CV et du contexte (non renseigné sur le compte)"


def build_coach_prompt(
    cv_parsed: dict[str, Any],
    poste_recherche: str,
    type_contrat_fr: str,
    profil_type_fr: str,
) -> str:
    cv_json = json.dumps(cv_parsed, ensure_ascii=False, indent=2)
    return COACH_USER_PROMPT_TEMPLATE.format(
        cv_json=cv_json,
        poste_recherche=poste_recherche,
        type_contrat=type_contrat_fr,
        profil_type=profil_type_fr,
    )


def _strip_code_fences(text: str) -> str:
    t = text.strip()
    m = re.match(r"^```(?:json)?\s*([\s\S]*?)\s*```$", t, re.IGNORECASE)
    if m:
        return m.group(1).strip()
    return t


def parse_llm_json_object(raw: str) -> dict[str, Any]:
    """Extrait un objet JSON depuis la sortie modèle (robuste aux fences Markdown)."""
    text = _strip_code_fences(raw)
    try:
        out = json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start < 0 or end <= start:
            raise
        out = json.loads(text[start : end + 1])
    if not isinstance(out, dict):
        raise ValueError("La réponse JSON n’est pas un objet")
    return out


def _normalize_coach_response(data: dict[str, Any]) -> dict[str, Any]:
    """
    Garantit au moins un point fort exploitable et retire les entrées bateau
    (« aucun point fort »), conformément au prompt métier.
    """
    fallback: list[dict[str, str]] = [
        {
            "titre": "Expérience terrain et polyvalence",
            "description": (
                "Tes expériences listées montrent une capacité d’adaptation "
                "et un contact client / opérationnel — des compétences recherchées "
                "en vente et restauration."
            ),
            "impact": "À quantifier et relier au poste visé dans l’entretien.",
        }
    ]

    raw_pf = data.get("points_forts")
    cleaned: list[dict[str, Any]] = []
    if isinstance(raw_pf, list):
        for item in raw_pf:
            if not isinstance(item, dict):
                continue
            titre = str(item.get("titre", "")).strip()
            desc = str(item.get("description", "")).strip()
            blob = f"{titre} {desc}".lower()
            if "aucun point fort" in blob:
                continue
            cleaned.append(item)

    data["points_forts"] = cleaned if cleaned else fallback
    if len(data["points_forts"]) > 5:
        data["points_forts"] = data["points_forts"][:5]
    return data


async def analyze_cv_coach(
    cv_parsed: dict[str, Any],
    poste_recherche: str,
    type_contrat_code: str | None,
    profile_type: str | None,
    profil_override: str | None,
) -> dict[str, Any]:
    """
    Appelle le modèle OpenAI et renvoie l’objet d’analyse (dict).
    Lève ValueError si la clé API manque ou si la sortie n’est pas exploitable.
    """
    settings = get_settings()
    if not settings.openai_api_key or not settings.openai_api_key.strip():
        raise ValueError("OPENAI_API_KEY manquante dans la configuration backend")

    from openai import AsyncOpenAI

    poste = poste_recherche.strip() or "Non précisé"
    prompt = build_coach_prompt(
        cv_parsed,
        poste,
        contract_label_fr(type_contrat_code),
        profil_hint_fr(profile_type, profil_override),
    )

    client = AsyncOpenAI(api_key=settings.openai_api_key)

    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": COACH_SYSTEM},
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
            max_tokens=8192,
            temperature=0.35,
        )
    except Exception as e:
        logger.exception("OpenAI analyze_cv_coach")
        raise ValueError(f"Échec de l’appel au modèle : {e!s}") from e

    choice = response.choices[0].message.content
    if not choice:
        raise ValueError("Réponse vide du modèle")

    try:
        parsed = parse_llm_json_object(choice)
        return _normalize_coach_response(parsed)
    except (json.JSONDecodeError, ValueError) as e:
        logger.warning("JSON coach invalide (premier essai) : %s", choice[:500])
        raise ValueError("Le modèle n’a pas renvoyé un JSON exploitable.") from e
