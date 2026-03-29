import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Cache en mémoire : SIREN → URL trouvée (ou null)
const cache = new Map<string, { url: string | null; ts: number }>();
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24h

function cachedGet(siren: string): string | null | undefined {
  const entry = cache.get(siren);
  if (!entry) return undefined;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    cache.delete(siren);
    return undefined;
  }
  return entry.url;
}

function cachedSet(siren: string, url: string | null) {
  cache.set(siren, { url, ts: Date.now() });
}

/**
 * Extrait le domaine racine d'une URL et le retourne proprement.
 * Ex : "https://www.carrefour.fr/page" → "https://www.carrefour.fr"
 */
function rootUrl(raw: string): string {
  try {
    const u = new URL(raw);
    return `${u.protocol}//${u.host}`;
  } catch {
    return raw;
  }
}

/**
 * Blacklist de domaines à exclure (réseaux sociaux, annuaires, etc.)
 */
const BLACKLIST = [
  "linkedin.com", "facebook.com", "twitter.com", "instagram.com",
  "youtube.com", "wikipedia.org", "wikimedia.org",
  "societe.com", "verif.com", "infogreffe.fr", "pappers.fr",
  "annuaire-entreprises.data.gouv.fr", "sirene.fr", "bilans-gratuits.com",
  "manageo.fr", "societe.ninja", "google.com", "bing.com",
  "pagesjaunes.fr", "pagesblanches.fr", "kompass.com", "europages.fr",
  "ouest-france.fr", "lefigaro.fr", "lemonde.fr",
];

function isBlacklisted(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace("www.", "");
    return BLACKLIST.some((b) => host.includes(b));
  } catch {
    return true;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const siren = (searchParams.get("siren") ?? "").trim();
  const nom = (searchParams.get("nom") ?? "").trim();

  if (!siren && !nom) {
    return NextResponse.json({ url: null });
  }

  // Cache hit
  const cacheKey = siren || nom;
  const cached = cachedGet(cacheKey);
  if (cached !== undefined) {
    return NextResponse.json({ url: cached });
  }

  const apiKey = process.env.SERPER_API_KEY?.trim();
  if (!apiKey) {
    // Pas de clé → on retourne null proprement (pas d'erreur affichée)
    cachedSet(cacheKey, null);
    return NextResponse.json({ url: null });
  }

  const query = nom ? `${nom} site officiel` : siren;

  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: query,
        gl: "fr",
        hl: "fr",
        num: 5,
      }),
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      cachedSet(cacheKey, null);
      return NextResponse.json({ url: null });
    }

    const data = (await res.json()) as {
      organic?: Array<{ link?: string; title?: string }>;
      knowledgeGraph?: { website?: string };
    };

    // 1. Knowledge Graph → souvent le site officiel direct
    const kgUrl = data.knowledgeGraph?.website;
    if (kgUrl && !isBlacklisted(kgUrl)) {
      const url = rootUrl(kgUrl);
      cachedSet(cacheKey, url);
      return NextResponse.json({ url });
    }

    // 2. Premiers résultats organiques filtrés
    const organic = data.organic ?? [];
    for (const result of organic) {
      const link = result.link;
      if (link && !isBlacklisted(link)) {
        const url = rootUrl(link);
        cachedSet(cacheKey, url);
        return NextResponse.json({ url });
      }
    }

    cachedSet(cacheKey, null);
    return NextResponse.json({ url: null });
  } catch {
    cachedSet(cacheKey, null);
    return NextResponse.json({ url: null });
  }
}
