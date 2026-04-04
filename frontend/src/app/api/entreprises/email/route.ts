import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// ─── Types ────────────────────────────────────────────────────────────────────

export type EmailContact = {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  position?: string | null;
  seniority?: string | null;
  department?: string | null;
  confidence?: number | null;
  source: "hunter" | "scrape";
  isHr?: boolean;
};

export type EmailResult = {
  domain: string | null;
  websiteUrl: string | null;
  contacts: EmailContact[];
  error?: string;
  /** Raison quand aucun email trouvé mais site existant */
  noEmailReason?: "no_public_email" | "no_website";
};

// ─── Cache mémoire (siren → résultat, 24h) ───────────────────────────────────

const emailCache = new Map<string, { result: EmailResult; ts: number }>();
const CACHE_TTL = 1000 * 60 * 60 * 24;

function cachedGet(key: string): EmailResult | undefined {
  const entry = emailCache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.ts > CACHE_TTL) { emailCache.delete(key); return undefined; }
  return entry.result;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Extrait le domaine racine d'une URL (ex: "carrefour.fr"). */
function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Blacklist domaines génériques à ne pas scraper/hunter. */
const DOMAIN_BLACKLIST = [
  "linkedin.com", "facebook.com", "twitter.com", "instagram.com",
  "youtube.com", "wikipedia.org", "google.com", "bing.com",
  "societe.com", "pappers.fr", "annuaire-entreprises.data.gouv.fr",
  "pages-jaunes.fr", "pagesjaunes.fr", "kompass.com",
];

function isBlacklisted(domain: string): boolean {
  return DOMAIN_BLACKLIST.some((b) => domain.includes(b));
}

/**
 * Scrape la page d'accueil et les pages contact/about
 * pour extraire les emails visibles.
 */
// Patterns d'emails RH typiques — priorité maximale
const HR_EMAIL_PATTERNS = [
  /^rh@/, /^drh@/, /^recrutement@/, /^recruitment@/, /^candidature@/,
  /^emploi@/, /^jobs@/, /^carriere@/, /^carrieres@/, /^talent@/, /^talents@/,
  /^hr@/, /^humanresources@/, /^ressourceshumaines@/, /^people@/,
  /recrutement/, /candidature/, /\.rh@/, /\.drh@/,
];

function isHrEmail(email: string): boolean {
  return HR_EMAIL_PATTERNS.some((p) => p.test(email));
}

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const IGNORE_PATTERNS = [
  /^no.?reply@/i, /^noreply@/i, /^donotreply@/i, /^bounce@/i, /^mailer@/i,
  /example\.(com|org|net)/i, /^test@/i, /sentry\.io/i, /wixpress\.com/i,
  /\.(png|jpg|gif|svg|js|css)$/i, /w3\.org/i, /schema\.org/i,
  /yourdomain/i, /domain\.com/i, /email@/i, /^info@info\./i,
  /googletagmanager/i, /googleapis/i, /cloudflare/i, /wordpress\.org/i,
];

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&#x40;/gi, "@").replace(/&#64;/g, "@")
    .replace(/&#x2e;/gi, ".").replace(/&#46;/g, ".")
    .replace(/&amp;/g, "&").replace(/\[at\]/gi, "@")
    .replace(/\[dot\]/gi, ".").replace(/\s*\(at\)\s*/gi, "@")
    .replace(/\s*\(dot\)\s*/gi, ".");
}

/** Extrait les liens internes du HTML (href="/contact", href="https://site.fr/...") */
function extractInternalLinks(html: string, baseUrl: string): string[] {
  const base = new URL(baseUrl);
  const links = new Set<string>();
  const hrefMatches = [...html.matchAll(/href=["']([^"'#?]+)/gi)];
  for (const m of hrefMatches) {
    const href = m[1].trim();
    if (!href) continue;
    try {
      const url = new URL(href, base.origin);
      if (url.hostname === base.hostname) links.add(url.href);
    } catch { continue; }
  }
  // Filtrer sur des mots-clés utiles
  const USEFUL = /contact|recrutement|carrieres?|emploi|jobs?|about|equipe|team|nous-contacter|a-propos|qui-sommes|mentions/i;
  return [...links].filter((l) => USEFUL.test(l)).slice(0, 8);
}

function extractEmailsFromHtml(html: string): string[] {
  const decoded = decodeHtmlEntities(html);
  const mailtoMatches = [...decoded.matchAll(/href=["']mailto:([^"'?]+)/gi)].map((m) => m[1]);
  const rawMatches = decoded.match(EMAIL_REGEX) ?? [];
  return [...mailtoMatches, ...rawMatches];
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "fr-FR,fr;q=0.9",
      },
      signal: AbortSignal.timeout(5000),
      redirect: "follow",
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function scrapeEmails(websiteUrl: string): Promise<{ email: string; isHr: boolean }[]> {
  const found = new Map<string, boolean>(); // email → isHr

  function addEmail(raw: string) {
    const clean = raw.toLowerCase().trim().replace(/[;,\s].*$/, "");
    if (!clean.includes("@")) return;
    if (IGNORE_PATTERNS.some((p) => p.test(clean))) return;
    if (clean.length > 80 || clean.length < 6) return;
    if (!found.has(clean)) found.set(clean, isHrEmail(clean));
  }

  // Étape 1 : scraper la homepage et découvrir les liens internes utiles
  const homeHtml = await fetchPage(websiteUrl);
  if (homeHtml) {
    for (const e of extractEmailsFromHtml(homeHtml)) addEmail(e);
    // Découverte dynamique des pages contact/recrutement
    const internalLinks = extractInternalLinks(homeHtml, websiteUrl);

    // Étape 2 : scraper les pages utiles trouvées + les URLs classiques en parallèle
    const classicPaths = [
      "/contact", "/nous-contacter", "/contactez-nous",
      "/recrutement", "/carrieres", "/emploi", "/jobs",
      "/a-propos", "/about", "/qui-sommes-nous", "/equipe",
      "/mentions-legales",
    ].map((p) => `${websiteUrl}${p}`);

    // Dédoubler : classiques + découverts dynamiquement
    const allToScrape = [...new Set([...internalLinks, ...classicPaths])].slice(0, 14);

    const results = await Promise.allSettled(allToScrape.map(fetchPage));
    for (const r of results) {
      if (r.status === "fulfilled" && r.value) {
        for (const e of extractEmailsFromHtml(r.value)) addEmail(e);
      }
    }
  }

  // Trier : emails RH en premier
  const entries = [...found.entries()];
  entries.sort((a, b) => (b[1] ? 1 : 0) - (a[1] ? 1 : 0));
  return entries.slice(0, 12).map(([email, isHr]) => ({ email, isHr }));
}

// Départements Hunter triés par priorité pour la prospection RH
const DEPT_PRIORITY: Record<string, number> = {
  hr: 0,
  management: 1,
  executive: 2,
  operations: 3,
  finance: 4,
  sales: 5,
  marketing: 6,
  communication: 7,
  it: 8,
  support: 9,
};

function hunterDeptScore(dept: string | null | undefined): number {
  if (!dept) return 99;
  return DEPT_PRIORITY[dept.toLowerCase()] ?? 50;
}

type HunterEmail = {
  value?: string;
  first_name?: string;
  last_name?: string;
  position?: string;
  seniority?: string;
  department?: string;
  confidence?: number;
};

async function fetchHunterPage(domain: string, apiKey: string): Promise<HunterEmail[]> {
  const url = new URL("https://api.hunter.io/v2/domain-search");
  url.searchParams.set("domain", domain);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("limit", "10");

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(6000) });
  if (!res.ok) return [];

  const data = (await res.json()) as {
    data?: { emails?: HunterEmail[] };
    errors?: unknown;
  };
  return data.data?.emails ?? [];
}

/**
 * Recherche Hunter.io par domaine → contacts triés RH en premier.
 */
async function searchHunter(domain: string): Promise<EmailContact[]> {
  const apiKey = process.env.HUNTER_API_KEY?.trim();
  if (!apiKey) return [];

  try {
    const emails = await fetchHunterPage(domain, apiKey);

    const contacts = emails
      .filter((e) => e.value && (e.confidence ?? 0) >= 50)
      .map((e) => ({
        email: e.value!.toLowerCase(),
        firstName: e.first_name ?? null,
        lastName: e.last_name ?? null,
        position: e.position ?? null,
        seniority: e.seniority ?? null,
        department: e.department ?? null,
        confidence: e.confidence ?? null,
        source: "hunter" as const,
      }));

    // Trier : RH/management en premier, puis par confiance décroissante
    contacts.sort((a, b) => {
      const deptDiff = hunterDeptScore(a.department) - hunterDeptScore(b.department);
      if (deptDiff !== 0) return deptDiff;
      return (b.confidence ?? 0) - (a.confidence ?? 0);
    });

    return contacts;
  } catch {
    return [];
  }
}

/**
 * Trouve le site web d'une entreprise via Serper si pas fourni.
 */
async function findWebsite(nom: string, siren?: string): Promise<string | null> {
  const apiKey = process.env.SERPER_API_KEY?.trim();
  if (!apiKey) return null;

  try {
    const query = nom ? `${nom} site officiel` : (siren ?? "");
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ q: query, gl: "fr", hl: "fr", num: 5 }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;

    const BLACKLIST_DOMAINS = [
      "linkedin.com", "facebook.com", "twitter.com", "societe.com",
      "pappers.fr", "verif.com", "annuaire-entreprises.data.gouv.fr",
      "pagesjaunes.fr", "kompass.com", "google.com",
    ];

    const data = (await res.json()) as {
      organic?: Array<{ link?: string }>;
      knowledgeGraph?: { website?: string };
    };

    const kgUrl = data.knowledgeGraph?.website;
    if (kgUrl) {
      const host = new URL(kgUrl).hostname.replace("www.", "");
      if (!BLACKLIST_DOMAINS.some((b) => host.includes(b))) {
        return `${new URL(kgUrl).protocol}//${new URL(kgUrl).host}`;
      }
    }

    for (const r of data.organic ?? []) {
      if (!r.link) continue;
      try {
        const host = new URL(r.link).hostname.replace("www.", "");
        if (!BLACKLIST_DOMAINS.some((b) => host.includes(b))) {
          return `${new URL(r.link).protocol}//${new URL(r.link).host}`;
        }
      } catch { continue; }
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const siren = (searchParams.get("siren") ?? "").trim();
  const nom = (searchParams.get("nom") ?? "").trim();
  const websiteParam = (searchParams.get("website") ?? "").trim();
  const isDebug = searchParams.get("debug") === "1";

  if (!siren && !nom) {
    return NextResponse.json({ domain: null, websiteUrl: null, contacts: [], error: "Paramètres manquants." });
  }

  const cacheKey = siren || nom;
  const cached = cachedGet(cacheKey);
  if (cached) return NextResponse.json(cached);

  // 1. Trouver le site web
  let websiteUrl: string | null = websiteParam || null;
  if (!websiteUrl) {
    websiteUrl = await findWebsite(nom, siren);
  }

  const domain = websiteUrl ? extractDomain(websiteUrl) : null;

  if (isDebug) {
    return NextResponse.json({
      debug: true,
      hasHunterKey: !!process.env.HUNTER_API_KEY?.trim(),
      hasSerperKey: !!process.env.SERPER_API_KEY?.trim(),
      websiteUrl,
      domain,
      isBlacklisted: domain ? isBlacklisted(domain) : null,
    });
  }

  if (!websiteUrl || !domain || isBlacklisted(domain)) {
    const result: EmailResult = { domain: null, websiteUrl: null, contacts: [], noEmailReason: "no_website" };
    emailCache.set(cacheKey, { result, ts: Date.now() });
    return NextResponse.json(result);
  }

  // 2. Scraping + Hunter en parallèle
  const [scraped, hunterContacts] = await Promise.all([
    scrapeEmails(websiteUrl),
    searchHunter(domain),
  ]);

  // 3. Fusionner : RH scrapés → Hunter trié → autres scrapés (sans doublons)
  const hunterEmails = new Set(hunterContacts.map((c) => c.email));

  const hrScraped: EmailContact[] = scraped
    .filter((e) => e.isHr && !hunterEmails.has(e.email))
    .map((e) => ({ email: e.email, isHr: true, source: "scrape" as const }));

  const otherScraped: EmailContact[] = scraped
    .filter((e) => !e.isHr && !hunterEmails.has(e.email))
    .map((e) => ({ email: e.email, source: "scrape" as const }));

  const contacts = [...hrScraped, ...hunterContacts, ...otherScraped];

  const result: EmailResult = {
    domain,
    websiteUrl,
    contacts,
    ...(contacts.length === 0 ? { noEmailReason: "no_public_email" } : {}),
  };
  emailCache.set(cacheKey, { result, ts: Date.now() });
  return NextResponse.json(result);
}
