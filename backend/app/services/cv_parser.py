"""Service de parsing et scoring de CV (PDF + DOCX).

L’extraction PDF produit souvent du texte « collé » (ex. COMPÉTENCESElfahim) : on normalise
le texte, puis on préfère une extraction structurée via OpenAI si OPENAI_API_KEY est définie.
"""

from __future__ import annotations

import io
import json
import logging
import re
from typing import Any

from PyPDF2 import PdfReader
from docx import Document

from app.config import get_settings

logger = logging.getLogger(__name__)

# Mots-clés de langues : ne doivent pas apparaître comme « compétences » seules
_LANG_SUBSTRINGS = (
    "anglais",
    "english",
    "espagnol",
    "spanish",
    "français",
    "french",
    "allemand",
    "german",
    "italien",
    "italian",
    "arabe",
    "arabis",
    "chinois",
    "mandarin",
    "japonais",
    "coréen",
    "russe",
    "portugais",
    "néerlandais",
    "dutch",
    "bilingue",
    "courant",
    "notions",
    "intermédiaire",
    "intermediaire",
    "langue maternelle",
    "toeic",
    "toefl",
    "delf",
    "dalf",
)

# Pattern date seule (à exclure des listes langues / compétences)
_DATE_ONLY = re.compile(
    r"^\s*\d{1,2}\s*[/.\-]\s*\d{1,2}\s*[/.\-]\s*\d{2,4}\s*$"
)
# Année seule ou courte
_YEARISH = re.compile(r"^\s*\d{4}\s*(-\s*\d{4})?\s*$")

_EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
_PHONE_RE = re.compile(r"(?:\+33|0033|0)\s*[1-9](?:[\s.\-]*\d{2}){4}")


def _normalize_cv_text(text: str) -> str:
    """
    Atténue les artefacts PDF : mots collés (minuscule + majuscule),
    rubriques collées au contenu (COMPÉTENCESNom, D'INTÉRÊTFORMATION).
    """
    if not text:
        return ""
    t = text.replace("\r\n", "\n").replace("\r", "\n")
    # Espace entre minuscule/ chiffre et majuscule suivante (mot collé)
    t = re.sub(
        r"([a-zàâäéèêëïîôùûüç0-9])([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜ])",
        r"\1 \2",
        t,
    )
    # Rubriques fréquentes collées à une lettre
    rubrics = (
        "COMPÉTENCES",
        "COMPETENCES",
        "FORMATION",
        "FORMATIONS",
        "EXPÉRIENCES",
        "EXPERIENCES",
        "EXPÉRIENCE",
        "EXPERIENCE",
        "LANGUES",
        "LANGUE",
        "PROFIL",
        "CONTACT",
        "CENTRES",
        "CENTRE",
        "INTÉRÊT",
        "INTERET",
        "DIPLÔME",
        "DIPLOME",
    )
    for r in rubrics:
        t = re.sub(rf"({r})([A-Za-zÀ-ÿ])", r"\1 \2", t, flags=re.IGNORECASE)
    return t


def _extract_text_from_pdf(content: bytes) -> str:
    reader = PdfReader(io.BytesIO(content))
    text_parts: list[str] = []
    for page in reader.pages:
        extracted = page.extract_text()
        if extracted:
            text_parts.append(extracted)
    return "\n".join(text_parts)


def _extract_text_from_docx(content: bytes) -> str:
    doc = Document(io.BytesIO(content))
    return "\n".join(paragraph.text for paragraph in doc.paragraphs if paragraph.text.strip())


def _looks_like_contact_or_noise(line: str) -> bool:
    s = line.strip()
    if not s:
        return True
    if _EMAIL_RE.search(s) or _PHONE_RE.search(s):
        return True
    if _DATE_ONLY.match(s) or _YEARISH.match(s):
        return True
    low = s.lower()
    if "@" in s:
        return True
    # Adresse / ville seule très courte
    if len(s) < 60 and re.match(r"^\d+\s+rue\s+", low):
        return True
    if s in ("versailles", "paris", "lyon", "marseille") and len(s) < 20:
        return True
    return False


def _is_probably_language_item(s: str) -> bool:
    low = s.lower().strip()
    if any(k in low for k in _LANG_SUBSTRINGS):
        return True
    if re.search(r"\b([abc][12]|c[12])\b", low):
        return True
    return False


def _clean_string_list(items: Any, *, drop_dates: bool = True) -> list[str]:
    if not isinstance(items, list):
        return []
    out: list[str] = []
    for x in items:
        if not isinstance(x, str):
            continue
        s = " ".join(x.split()).strip()
        if not s or len(s) > 800:
            continue
        if drop_dates and (_DATE_ONLY.match(s) or _YEARISH.match(s)):
            continue
        out.append(s)
    return out


def _reconcile_skills_languages(skills: list[str], languages: list[str]) -> tuple[list[str], list[str]]:
    """Retire les langues des compétences et complète les langues si besoin."""
    langs = list(dict.fromkeys(languages))  # dédoublonnage ordre préservé
    skills_out: list[str] = []
    for sk in skills:
        if _DATE_ONLY.match(sk.strip()) or _YEARISH.match(sk.strip()):
            continue
        if _is_probably_language_item(sk):
            if sk not in langs:
                langs.append(sk)
            continue
        skills_out.append(sk)
    langs = [l for l in langs if not _DATE_ONLY.match(l.strip())]
    return skills_out, langs


def _clip_str(v: Any, max_len: int) -> str:
    if v is None:
        return ""
    s = str(v).strip()
    return s[:max_len] if len(s) > max_len else s


def _coerce_personal(raw: Any) -> dict[str, str]:
    if not isinstance(raw, dict):
        return {"full_name": "", "address": "", "city": "", "postal_code": ""}
    return {
        "full_name": _clip_str(raw.get("full_name"), 200),
        "address": _clip_str(raw.get("address"), 300),
        "city": _clip_str(raw.get("city"), 120),
        "postal_code": _clip_str(raw.get("postal_code"), 20),
    }


def _coerce_experience_items(raw: Any) -> list[dict[str, Any]]:
    if not isinstance(raw, list):
        return []
    out: list[dict[str, Any]] = []
    for x in raw:
        if not isinstance(x, dict):
            continue
        title = _clip_str(x.get("job_title") or x.get("title") or x.get("poste"), 200)
        company = _clip_str(x.get("company") or x.get("employer") or x.get("entreprise"), 200)
        out.append(
            {
                "job_title": title,
                "company": company,
                "start_date": _clip_str(x.get("start_date"), 80),
                "end_date": _clip_str(x.get("end_date"), 80),
                "description": _clip_str(x.get("description"), 4000),
                "is_current": bool(x.get("is_current") or x.get("current")),
            }
        )
        if len(out) >= 15:
            break
    return out


def _coerce_education_items(raw: Any) -> list[dict[str, Any]]:
    if not isinstance(raw, list):
        return []
    out: list[dict[str, Any]] = []
    for x in raw:
        if not isinstance(x, dict):
            continue
        out.append(
            {
                "diploma": _clip_str(x.get("diploma") or x.get("degree") or x.get("diplome"), 300),
                "institution": _clip_str(
                    x.get("institution") or x.get("school") or x.get("etablissement"), 300
                ),
                "start_date": _clip_str(x.get("start_date"), 80),
                "end_date": _clip_str(x.get("end_date"), 80),
                "in_progress": bool(x.get("in_progress") or x.get("en_cours")),
            }
        )
        if len(out) >= 15:
            break
    return out


def _coerce_language_items(raw: Any) -> list[dict[str, str]]:
    if not isinstance(raw, list):
        return []
    out: list[dict[str, str]] = []
    for x in raw:
        if isinstance(x, dict):
            lang = _clip_str(x.get("language") or x.get("name") or x.get("langue"), 80)
            lvl = _clip_str(x.get("level") or x.get("niveau"), 80)
        elif isinstance(x, str):
            parts = re.split(r"\s*[—\-:]\s*", x, maxsplit=1)
            lang = parts[0].strip()[:80] if parts else ""
            lvl = parts[1].strip()[:80] if len(parts) > 1 else ""
        else:
            continue
        if not lang or _DATE_ONLY.match(lang):
            continue
        out.append({"language": lang, "level": lvl})
        if len(out) >= 12:
            break
    return out


def _experience_to_line(e: dict[str, Any]) -> str:
    head = " — ".join(p for p in (e.get("job_title"), e.get("company")) if p)
    dates = ""
    sd, ed = e.get("start_date") or "", e.get("end_date") or ""
    if sd or ed:
        suf = " (en cours)" if e.get("is_current") else ""
        dates = f"{sd} → {ed}{suf}"
    desc = (e.get("description") or "").strip()
    parts = [p for p in (head, dates, desc) if p]
    return "\n".join(parts)


def _education_to_line(e: dict[str, Any]) -> str:
    head = " — ".join(p for p in (e.get("diploma"), e.get("institution")) if p)
    sd, ed = e.get("start_date") or "", e.get("end_date") or ""
    dates = ""
    if sd or ed:
        dates = f"{sd} → {ed}"
    if e.get("in_progress"):
        dates = (dates + " (en cours)").strip()
    parts = [p for p in (head, dates) if p]
    return "\n".join(parts)


def _language_items_to_strings(items: list[dict[str, str]]) -> list[str]:
    out: list[str] = []
    for it in items:
        lang = it.get("language") or ""
        lv = it.get("level") or ""
        if not lang:
            continue
        out.append(f"{lang} — {lv}" if lv else lang)
    return out


def _finalize_cv_output(raw: dict[str, Any], normalized_full: str) -> dict[str, Any]:
    """
    Produit l’objet `cv_parsed` final : champs formulaire (OpenAI) + tableaux « plats »
    pour compatibilité (lettres, coach, etc.).
    """
    personal = _coerce_personal(raw.get("personal"))
    professional_summary = _clip_str(raw.get("professional_summary"), 4000)

    exp_items = _coerce_experience_items(raw.get("experience_items"))
    exp_items = [
        e
        for e in exp_items
        if (e.get("job_title") or e.get("company") or (str(e.get("description") or "")).strip())
    ]
    if not exp_items:
        for line in _clean_string_list(raw.get("experiences")):
            if _looks_like_contact_or_noise(line):
                continue
            exp_items.append(
                {
                    "job_title": "",
                    "company": "",
                    "start_date": "",
                    "end_date": "",
                    "description": line[:4000],
                    "is_current": False,
                }
            )

    edu_items = _coerce_education_items(raw.get("education_items"))
    edu_items = [
        e
        for e in edu_items
        if (
            e.get("diploma")
            or e.get("institution")
            or e.get("start_date")
            or e.get("end_date")
        )
    ]
    if not edu_items:
        for line in _clean_string_list(raw.get("education")):
            if _EMAIL_RE.search(line) or _PHONE_RE.search(line):
                continue
            edu_items.append(
                {
                    "diploma": line[:300],
                    "institution": "",
                    "start_date": "",
                    "end_date": "",
                    "in_progress": False,
                }
            )

    lang_items = _coerce_language_items(raw.get("language_items"))
    langs_flat = _language_items_to_strings(lang_items)
    if not langs_flat:
        langs_flat = _clean_string_list(raw.get("languages"))

    skills = _clean_string_list(raw.get("skills"))
    skills, langs_flat = _reconcile_skills_languages(skills, langs_flat)

    lang_items = []
    for s in langs_flat:
        if "—" in s:
            a, b = s.split("—", 1)
            lang_items.append({"language": a.strip()[:80], "level": b.strip()[:80]})
        else:
            lang_items.append({"language": s.strip()[:80], "level": ""})

    interests = _clean_string_list(raw.get("interests"), drop_dates=True)[:30]

    email = raw.get("email")
    email = email.strip() if isinstance(email, str) and email.strip() else None
    phone = raw.get("phone")
    phone = phone.strip() if isinstance(phone, str) and phone.strip() else None

    if not email:
        m = _EMAIL_RE.search(normalized_full)
        email = m.group(0) if m else None
    if not phone:
        m = _PHONE_RE.search(normalized_full)
        phone = m.group(0).replace(" ", "") if m else None

    experiences_lines = [
        _experience_to_line(e)
        for e in exp_items
        if (e.get("job_title") or e.get("company") or (e.get("description") or "").strip())
    ]
    education_lines = []
    for e in edu_items:
        line = _education_to_line(e)
        if line:
            education_lines.append(line)

    return {
        "full_text": normalized_full[:5000],
        "email": email,
        "phone": phone,
        "personal": personal,
        "professional_summary": professional_summary,
        "experience_items": exp_items,
        "education_items": edu_items,
        "language_items": lang_items,
        "interests": interests,
        "experiences": experiences_lines[:25],
        "education": education_lines[:25],
        "skills": skills[:40],
        "languages": langs_flat[:15],
    }


def _extract_section_between(
    text: str,
    start_kw: list[str],
    stop_kw: list[str],
    max_items: int = 25,
) -> list[str]:
    """Extrait des lignes entre une rubrique de début et la prochaine rubrique."""
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    in_section = False
    out: list[str] = []

    def is_header(line: str, kws: list[str]) -> bool:
        low = line.lower()
        return any(k in low for k in kws) and len(line) < 85

    for line in lines:
        if not in_section:
            if is_header(line, start_kw):
                in_section = True
            continue
        if is_header(line, stop_kw):
            break
        if line.isupper() and len(line) < 45 and any(
            k in line.lower() for k in ["formation", "compétence", "langue", "expérience", "contact"]
        ):
            break
        if _looks_like_contact_or_noise(line) and len(out) == 0:
            continue
        out.append(line)
        if len(out) >= max_items:
            break
    return out


_STOP_COMMON = [
    "formation",
    "formations",
    "diplôme",
    "diplome",
    "compétence",
    "competence",
    "langue",
    "langues",
    "centre d'intérêt",
    "centres d'intérêt",
    "projets",
    "références",
    "contact",
]


def _parse_text_heuristic(normalized: str) -> dict[str, Any]:
    """Repli sans LLM : rubriques approximatives + regex contacts."""
    emails = _EMAIL_RE.findall(normalized)
    phones = _PHONE_RE.findall(normalized)

    experiences = _extract_section_between(
        normalized,
        [
            "expérience professionnelle",
            "expériences professionnelles",
            "expérience",
            "expériences",
            "parcours professionnel",
            "professional experience",
        ],
        _STOP_COMMON,
    )

    education = _extract_section_between(
        normalized,
        [
            "formation",
            "formations",
            "diplôme",
            "diplome",
            "cursus",
            "études",
            "etudes",
            "parcours académique",
            "education",
        ],
        [
            "expérience professionnelle",
            "expériences",
            "compétence",
            "langue",
            "centre d'intérêt",
            "contact",
        ],
    )

    skills_block = _extract_section_between(
        normalized,
        ["compétence", "competences", "compétences", "savoir-faire", "skills"],
        ["langue", "langues", "formation", "expérience", "centre d'intérêt", "contact"],
    )

    languages_block = _extract_section_between(
        normalized,
        ["langue", "langues", "languages"],
        ["formation", "compétence", "expérience", "centre d'intérêt", "contact", "projets"],
    )

    # Découpe compétences par puces / virgules si peu de lignes
    skills: list[str] = []
    for line in skills_block:
        parts = re.split(r"[,;•|·]|(?<=\s)-\s+", line)
        for p in parts:
            s = p.strip()
            if len(s) > 2 and s not in skills:
                skills.append(s)

    languages = []
    for line in languages_block:
        if _DATE_ONLY.match(line.strip()):
            continue
        languages.append(line)

    return {
        "email": emails[0] if emails else None,
        "phone": phones[0] if phones else None,
        "experiences": experiences,
        "education": education,
        "skills": skills,
        "languages": languages,
    }


async def _extract_openai(normalized: str) -> dict[str, Any] | None:
    settings = get_settings()
    key = (settings.openai_api_key or "").strip()
    if not key:
        return None

    from openai import AsyncOpenAI

    snippet = normalized[:14000]
    system = (
        "Tu extrais un CV français pour pré-remplir un formulaire web. "
        "Réponse : un seul objet JSON valide UTF-8, sans markdown ni texte hors JSON."
    )
    user = f"""Texte brut du CV (PDF souvent dégradé : mots collés, sections mélangées) :

---
{snippet}
---

Extrais et renvoie ce JSON :

{{
  "email": null,
  "phone": null,
  "personal": {{
    "full_name": "",
    "address": "",
    "city": "",
    "postal_code": ""
  }},
  "professional_summary": "",
  "experience_items": [
    {{
      "job_title": "",
      "company": "",
      "start_date": "",
      "end_date": "",
      "description": "",
      "is_current": false
    }}
  ],
  "education_items": [
    {{
      "diploma": "",
      "institution": "",
      "start_date": "",
      "end_date": "",
      "in_progress": false
    }}
  ],
  "skills": [],
  "language_items": [
    {{ "language": "", "level": "" }}
  ],
  "interests": []
}}

Règles obligatoires :
- "experience_items" : uniquement emplois / stages réels. Jamais email, téléphone, adresse seule, ni dates orphelines sans contexte pro.
- "education_items" : diplômes, cursus, écoles, années. Si rien dans le CV, tableau vide.
- "skills" : compétences techniques, outils, métiers, savoir-faire. INTERDIT d’y mettre des langues (anglais, espagnol, etc.).
- "language_items" : uniquement langues (ex. language "Anglais", level "Bilingue"). INTERDIT d’y mettre des dates seules JJ/MM/AAAA.
- "interests" : hobbies / centres d’intérêt si mentionnés, sinon [].
- "professional_summary" : paragraphe type accroche / profil en tête de CV si présent, sinon chaîne vide.
- Corrige mentalement les mots collés (ex. COMPÉTENCES / FORMATION) pour classer chaque information.

Si une rubrique est vide, utilise [] ou ""."""

    try:
        client = AsyncOpenAI(api_key=key)
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            response_format={"type": "json_object"},
            max_tokens=8192,
            temperature=0.05,
        )
    except Exception:
        logger.exception("OpenAI cv_parser extraction")
        return None

    content = response.choices[0].message.content
    if not content:
        return None
    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        logger.warning("cv_parser OpenAI JSON invalide")
        return None
    if not isinstance(data, dict):
        return None
    return data


async def parse_cv(content: bytes, content_type: str) -> dict:
    """Extrait les informations structurées d'un CV (PDF ou DOCX)."""
    if content_type == "application/pdf":
        text = _extract_text_from_pdf(content)
    else:
        text = _extract_text_from_docx(content)

    normalized = _normalize_cv_text(text)

    llm_raw = await _extract_openai(normalized)
    if llm_raw is not None:
        logger.info("CV parsé via OpenAI (formulaire structuré)")
        return _finalize_cv_output(llm_raw, normalized)

    raw_h = _parse_text_heuristic(normalized)
    logger.info("CV parsé via heuristiques (repli)")
    return _finalize_cv_output(raw_h, normalized)


def score_cv(parsed: dict) -> int:
    """
    Score le CV sur 100 points :
    - Expériences : 30 pts
    - Formation : 20 pts
    - Compétences : 20 pts
    - Contact (email + tél) : 15 pts
    - Langues : 15 pts
    """
    score = 0

    n_exp = len(parsed.get("experience_items") or []) or len(parsed.get("experiences") or [])
    if n_exp:
        score += min(30, n_exp * 5)

    n_edu = len(parsed.get("education_items") or []) or len(parsed.get("education") or [])
    if n_edu:
        score += min(20, n_edu * 5)

    if parsed.get("skills"):
        score += min(20, len(parsed["skills"]) * 2)

    if parsed.get("email"):
        score += 8
    if parsed.get("phone"):
        score += 7

    if parsed.get("languages"):
        score += min(15, len(parsed["languages"]) * 5)

    return min(100, score)
