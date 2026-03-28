"""Service pour trouver le site web d'une entreprise."""

import re
from typing import Optional
from urllib.parse import urlparse

import httpx


async def find_website(company_name: str, city: str = "") -> Optional[str]:
    """
    Cherche le site web d'une entreprise.
    1. Essaie Pappers.fr (scraping HTML)
    2. Fallback : recherche DuckDuckGo
    """
    website = await _search_pappers(company_name, city)
    if website:
        return website

    website = await _search_duckduckgo(company_name, city)
    return website


async def _search_pappers(company_name: str, city: str) -> Optional[str]:
    """Cherche sur Pappers.fr les infos enrichies de l'entreprise."""
    query = f"{company_name} {city}".strip()
    search_url = f"https://www.pappers.fr/recherche?q={query}"

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                search_url,
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                },
                follow_redirects=True,
                timeout=10.0,
            )

            if response.status_code != 200:
                return None

            # Chercher un lien de site web dans le HTML
            url_pattern = r'href="(https?://(?:www\.)?[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:/[^"]*)?)"'
            urls = re.findall(url_pattern, response.text)

            for url in urls:
                parsed = urlparse(url)
                domain = parsed.hostname or ""
                # Ignorer les domaines connus qui ne sont pas des sites d'entreprise
                if any(d in domain for d in [
                    "pappers.fr", "google.", "facebook.", "linkedin.",
                    "twitter.", "instagram.", "youtube.",
                ]):
                    continue
                return url

    except httpx.HTTPError:
        pass

    return None


async def _search_duckduckgo(company_name: str, city: str) -> Optional[str]:
    """Recherche le site via DuckDuckGo HTML (pas d'API requise)."""
    query = f"{company_name} {city} site officiel"

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://html.duckduckgo.com/html/",
                params={"q": query},
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                },
                timeout=10.0,
            )

            if response.status_code != 200:
                return None

            # Extraire le premier résultat pertinent
            url_pattern = r'href="(https?://(?:www\.)?[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:/[^"]*)?)"'
            urls = re.findall(url_pattern, response.text)

            for url in urls:
                parsed = urlparse(url)
                domain = parsed.hostname or ""
                if any(d in domain for d in [
                    "duckduckgo.", "google.", "facebook.", "linkedin.",
                    "twitter.", "instagram.", "youtube.", "wikipedia.",
                ]):
                    continue
                return f"{parsed.scheme}://{parsed.hostname}"

    except httpx.HTTPError:
        pass

    return None
