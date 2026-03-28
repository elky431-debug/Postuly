"""Service de scraping d'emails RH via Playwright."""

import re
from urllib.parse import urljoin

from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeout

from app.db.client import get_supabase_admin

PAGES_TO_CHECK = [
    "/contact",
    "/recrutement",
    "/carrieres",
    "/careers",
    "/equipe",
    "/team",
    "/nous-contacter",
    "/rejoignez-nous",
    "/jobs",
    "/emploi",
]

EMAIL_REGEX = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")

KEYWORDS_RH = [
    "rh", "recrutement", "drh", "emploi", "candidature",
    "talent", "people", "career", "job", "human",
]

FALLBACK_PREFIXES = ["rh@", "recrutement@", "contact@", "candidature@", "emploi@"]

# Domaines à ignorer (emails génériques de services tiers)
IGNORE_DOMAINS = {
    "gmail.com", "yahoo.com", "hotmail.com", "outlook.com",
    "example.com", "sentry.io", "facebook.com", "twitter.com",
    "cloudflare.com", "google.com", "w3.org",
}


async def scrape_emails_for_company(company_id: str, website_url: str) -> list[str]:
    """
    Scrape les emails RH d'un site web d'entreprise.
    Retourne la liste des emails trouvés.
    """
    if not website_url:
        return []

    # Normaliser l'URL
    if not website_url.startswith("http"):
        website_url = f"https://{website_url}"

    found_emails: set[str] = set()
    domain = _extract_domain(website_url)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            viewport={"width": 1280, "height": 720},
        )

        try:
            # 1. Scanner la page d'accueil
            page = await context.new_page()
            home_emails = await _scrape_page(page, website_url)
            found_emails.update(home_emails)

            # 2. Scanner les pages pertinentes
            for path in PAGES_TO_CHECK:
                url = urljoin(website_url, path)
                try:
                    page_emails = await _scrape_page(page, url)
                    found_emails.update(page_emails)
                except Exception:
                    continue

        except Exception:
            pass
        finally:
            await browser.close()

    # Filtrer : garder uniquement les emails du domaine de l'entreprise
    filtered = _filter_emails(found_emails, domain)

    # Prioriser les emails RH
    rh_emails = [e for e in filtered if any(kw in e.lower() for kw in KEYWORDS_RH)]
    other_emails = [e for e in filtered if e not in rh_emails]

    # Si rien trouvé, générer des patterns fallback
    if not rh_emails and not other_emails and domain:
        rh_emails = [f"{prefix}{domain}" for prefix in FALLBACK_PREFIXES]

    final_emails = rh_emails + other_emails

    # Sauvegarder dans la base
    await _save_emails(company_id, final_emails, has_fallback=not bool(found_emails))

    return final_emails


async def _scrape_page(page, url: str) -> set[str]:
    """Scrape une page pour trouver des emails."""
    emails: set[str] = set()

    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=15000)
        content = await page.content()

        # Chercher dans le HTML
        page_emails = EMAIL_REGEX.findall(content)
        emails.update(page_emails)

        # Chercher dans les liens mailto:
        mailto_links = await page.query_selector_all("a[href^='mailto:']")
        for link in mailto_links:
            href = await link.get_attribute("href")
            if href:
                email = href.replace("mailto:", "").split("?")[0].strip()
                if EMAIL_REGEX.match(email):
                    emails.add(email)

    except PlaywrightTimeout:
        pass
    except Exception:
        pass

    return emails


def _extract_domain(url: str) -> str:
    """Extrait le domaine principal d'une URL."""
    from urllib.parse import urlparse
    parsed = urlparse(url)
    hostname = parsed.hostname or ""
    # Enlever www.
    if hostname.startswith("www."):
        hostname = hostname[4:]
    return hostname


def _filter_emails(emails: set[str], company_domain: str) -> list[str]:
    """Filtre les emails pour garder uniquement ceux pertinents."""
    filtered: list[str] = []
    for email in emails:
        email_domain = email.split("@")[-1].lower()
        if email_domain in IGNORE_DOMAINS:
            continue
        if company_domain and company_domain not in email_domain:
            continue
        filtered.append(email.lower())
    return list(set(filtered))


async def _save_emails(
    company_id: str, emails: list[str], has_fallback: bool = False
) -> None:
    """Sauvegarde les emails trouvés dans la table email_contacts."""
    supabase = get_supabase_admin()

    for email in emails[:5]:  # Max 5 emails par entreprise
        source = "guessed" if has_fallback else "scraped"
        try:
            supabase.table("email_contacts").upsert(
                {
                    "company_id": company_id,
                    "email": email,
                    "source": source,
                    "verified": False,
                },
                on_conflict="company_id,email",
            ).execute()
        except Exception:
            continue
