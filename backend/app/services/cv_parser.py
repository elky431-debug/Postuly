"""Service de parsing et scoring de CV (PDF + DOCX)."""

import io
import re

from PyPDF2 import PdfReader
from docx import Document


async def parse_cv(content: bytes, content_type: str) -> dict:
    """Extrait les informations structurées d'un CV."""
    if content_type == "application/pdf":
        text = _extract_text_from_pdf(content)
    else:
        text = _extract_text_from_docx(content)

    return _parse_text(text)


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


def _parse_text(text: str) -> dict:
    """Parse le texte brut du CV pour en extraire les champs clés."""
    email_pattern = r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"
    phone_pattern = r"(?:\+33|0)\s*[1-9](?:[\s.-]*\d{2}){4}"

    emails = re.findall(email_pattern, text)
    phones = re.findall(phone_pattern, text)

    # Extraction basique par sections (heuristique)
    text_lower = text.lower()
    sections = {
        "experiences": _extract_section(text, [
            "expérience", "experience", "parcours professionnel", "stages",
        ]),
        "education": _extract_section(text, [
            "formation", "education", "diplôme", "cursus", "études",
        ]),
        "skills": _extract_skills(text),
        "languages": _extract_section(text, [
            "langue", "language", "langues",
        ]),
    }

    return {
        "full_text": text[:5000],
        "email": emails[0] if emails else None,
        "phone": phones[0] if phones else None,
        "experiences": sections["experiences"],
        "education": sections["education"],
        "skills": sections["skills"],
        "languages": sections["languages"],
    }


def _extract_section(text: str, keywords: list[str]) -> list[str]:
    """Extraction heuristique d'une section du CV."""
    lines = text.split("\n")
    in_section = False
    section_lines: list[str] = []

    for line in lines:
        line_stripped = line.strip()
        if not line_stripped:
            continue

        line_lower = line_stripped.lower()

        if any(kw in line_lower for kw in keywords) and len(line_stripped) < 50:
            in_section = True
            continue

        # Sortir de la section si on rencontre un autre titre
        if in_section and line_stripped.isupper() and len(line_stripped) < 50:
            break

        if in_section:
            section_lines.append(line_stripped)

    return section_lines[:20]


def _extract_skills(text: str) -> list[str]:
    """Extrait les compétences du CV."""
    common_skills = [
        "python", "javascript", "typescript", "react", "next.js", "node.js",
        "sql", "postgresql", "mongodb", "docker", "git", "aws", "azure",
        "java", "c++", "c#", "php", "ruby", "go", "rust", "swift",
        "html", "css", "tailwind", "figma", "photoshop",
        "excel", "powerpoint", "word", "pack office",
        "anglais", "espagnol", "allemand", "italien", "chinois",
        "gestion de projet", "management", "communication", "leadership",
        "marketing", "seo", "google analytics", "crm", "salesforce",
    ]

    text_lower = text.lower()
    found: list[str] = []

    for skill in common_skills:
        if skill in text_lower:
            found.append(skill)

    return found


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

    if parsed.get("experiences"):
        score += min(30, len(parsed["experiences"]) * 5)

    if parsed.get("education"):
        score += min(20, len(parsed["education"]) * 5)

    if parsed.get("skills"):
        score += min(20, len(parsed["skills"]) * 3)

    if parsed.get("email"):
        score += 8
    if parsed.get("phone"):
        score += 7

    if parsed.get("languages"):
        score += min(15, len(parsed["languages"]) * 5)

    return min(100, score)
