import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const FT_TOKEN_URL =
  "https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=%2Fpartenaire";
const FT_SEARCH_URL =
  "https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search";

// ─── Token cache ─────────────────────────────────────────────────────────────
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getToken(): Promise<string | null> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }
  const clientId = process.env.FRANCE_TRAVAIL?.trim();
  const clientSecret = process.env.FRANCE_TRAVAIL_API_KEY?.trim();
  if (!clientId || !clientSecret) return null;

  try {
    const res = await fetch(FT_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
        scope: "api_offresdemploiv2 o2dsoffre",
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { access_token: string; expires_in: number };
    cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
    return cachedToken.token;
  } catch {
    return null;
  }
}

// ─── Géolocalisation ville → département (BAN API) ───────────────────────────
async function getDepartement(ville: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(ville)}&limit=1`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      features?: Array<{ properties?: { context?: string; postcode?: string } }>;
    };
    const ctx = data.features?.[0]?.properties?.context ?? "";
    const dept = ctx.split(",")[0]?.trim();
    if (dept) return dept;
    const postcode = data.features?.[0]?.properties?.postcode ?? "";
    return postcode.startsWith("97") ? postcode.slice(0, 3) : postcode.slice(0, 2) || null;
  } catch {
    return null;
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────
export type FTOffre = {
  id: string;
  titre: string;
  entreprise: string | null;
  logoUrl: string | null;
  logoSource: "ft" | "clearbit" | null;
  lieu: string;
  codePostal: string | null;
  typeContrat: string;
  typeContratLibelle: string;
  salaire: string | null;
  salaireCommentaire: string | null;
  experience: string | null;
  experienceLibelle: string | null;
  description: string;
  dateCreation: string;
  dateActualisation: string;
  nombrePostes: number;
  secteurActivite: string | null;
  secteurActiviteLibelle: string | null;
  competences: string[];
  qualitesPro: string[];
  formations: string[];
  permis: string[];
  langues: string[];
  dureeTravail: string | null;
  alternance: boolean;
  accessibleTH: boolean;
  telContact: string | null;
  emailContact: string | null;
  urlPostulation: string | null;
  urlFranceTravail: string;
};

function mapOffre(raw: Record<string, unknown>): FTOffre {
  const entreprise = raw.entreprise as Record<string, unknown> | undefined;
  const lieuTravail = raw.lieuTravail as Record<string, unknown> | undefined;
  const salaire = raw.salaire as Record<string, unknown> | undefined;
  const contact = raw.contact as Record<string, unknown> | undefined;
  const agence = raw.agence as Record<string, unknown> | undefined;

  const nomEntreprise = (entreprise?.nom as string) || null;
  const logoFT = (entreprise?.logo as string) || null;

  // Clearbit domain guessing from company name
  let clearbitDomain: string | null = null;
  if (!logoFT && nomEntreprise) {
    const keyword = nomEntreprise
      .replace(/\b(SAS|SARL|SA|GIE|SASU|EURL|SNC|GROUP|GROUPE|FRANCE|SERVICES|SOLUTIONS)\b/gi, "")
      .trim()
      .toLowerCase()
      .split(/\s+/)[0]
      ?.replace(/[^a-z0-9-]/g, "") ?? "";
    if (keyword.length > 2) clearbitDomain = `${keyword}.com`;
  }

  return {
    id: raw.id as string,
    titre: raw.intitule as string ?? raw.appellationlibelle as string ?? "",
    entreprise: nomEntreprise,
    logoUrl: logoFT ?? (clearbitDomain ? `https://logo.clearbit.com/${clearbitDomain}` : null),
    logoSource: logoFT ? "ft" : clearbitDomain ? "clearbit" : null,
    lieu: (lieuTravail?.libelle as string) ?? "",
    codePostal: (lieuTravail?.codePostal as string) ?? null,
    typeContrat: (raw.typeContrat as string) ?? "",
    typeContratLibelle: (raw.typeContratLibelle as string) ?? (raw.typeContrat as string) ?? "",
    salaire: (salaire?.libelle as string) ?? null,
    salaireCommentaire: (salaire?.commentaire as string) ?? null,
    experience: (raw.experienceExige as string) ?? null,
    experienceLibelle: (raw.experienceLibelle as string) ?? null,
    description: (raw.description as string) ?? "",
    dateCreation: (raw.dateCreation as string) ?? "",
    dateActualisation: (raw.dateActualisation as string) ?? "",
    nombrePostes: (raw.nombrePostes as number) ?? 1,
    secteurActivite: (raw.secteurActivite as string) ?? null,
    secteurActiviteLibelle: (raw.secteurActiviteLibelle as string) ?? null,
    competences: ((raw.competences as Array<{ libelle: string }>) ?? []).map((c) => c.libelle),
    qualitesPro: ((raw.qualitesProfessionnelles as Array<{ libelle: string }>) ?? []).map((q) => q.libelle),
    formations: ((raw.formations as Array<{ niveauLibelle?: string; domaineLibelle?: string }>) ?? []).map(
      (f) => [f.niveauLibelle, f.domaineLibelle].filter(Boolean).join(" - ")
    ),
    permis: ((raw.permis as Array<{ libelle: string }>) ?? []).map((p) => p.libelle),
    langues: ((raw.langues as Array<{ libelle: string }>) ?? []).map((l) => l.libelle),
    dureeTravail: (raw.dureeTravailLibelleConverti as string) ?? (raw.dureeTravailLibelle as string) ?? null,
    alternance: !!(raw.alternance),
    accessibleTH: !!(raw.accessibleTH),
    telContact:
      (contact?.telephone as string) ?? (agence?.telephone as string) ?? null,
    emailContact:
      (contact?.courriel as string) ?? (agence?.courriel as string) ?? null,
    urlPostulation: (raw.urlPostulation as string) ?? null,
    urlFranceTravail: `https://candidat.francetravail.fr/offres/recherche/detail/${raw.id as string}`,
  };
}

// ─── Handler ─────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const keywords = searchParams.get("keywords") ?? "";
  const ville = searchParams.get("ville") ?? "";
  const contrat = searchParams.get("contrat") ?? "";
  const experience = searchParams.get("experience") ?? "";
  const page = Math.max(0, parseInt(searchParams.get("page") ?? "0", 10));
  const isDebug = searchParams.get("debug") === "1";

  const clientId = process.env.FRANCE_TRAVAIL?.trim();
  const clientSecret = process.env.FRANCE_TRAVAIL_API_KEY?.trim();

  if (isDebug) {
    // Test OAuth call for diagnosis
    let tokenResult: string | null = null;
    let tokenError: string | null = null;
    if (clientId && clientSecret) {
      try {
        const res = await fetch(FT_TOKEN_URL, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "client_credentials",
            client_id: clientId,
            client_secret: clientSecret,
            scope: "api_offresdemploiv2 o2dsoffre",
          }),
          signal: AbortSignal.timeout(5000),
        });
        const body = await res.text();
        tokenResult = `HTTP ${res.status}: ${body.slice(0, 300)}`;
      } catch (e) {
        tokenError = String(e);
      }
    }
    return NextResponse.json({
      hasFranceTravail: !!clientId,
      hasFranceTravailApiKey: !!clientSecret,
      clientIdPrefix: clientId ? clientId.slice(0, 12) + "..." : null,
      tokenResult,
      tokenError,
    });
  }

  const token = await getToken();
  if (!token) {
    const hasKeys = !!clientId && !!clientSecret;
    return NextResponse.json({
      offres: [],
      total: 0,
      error: hasKeys
        ? "Échec de l'authentification France Travail. Vérifie les clés."
        : "Clés France Travail manquantes.",
    });
  }

  let departement = "";
  if (ville.trim()) {
    departement = (await getDepartement(ville.trim())) ?? "";
  }

  const params = new URLSearchParams();
  if (keywords.trim()) params.set("motsCles", keywords.trim());
  if (departement) params.set("departement", departement);
  if (contrat) params.set("typeContrat", contrat);
  if (experience) params.set("experience", experience);

  const start = page * 20;
  params.set("range", `${start}-${Math.min(start + 19, start + 19)}`);
  params.set("sort", "1"); // pertinence

  const res = await fetch(`${FT_SEARCH_URL}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });

  if (res.status === 204) {
    return NextResponse.json({ offres: [], total: 0 });
  }

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    return NextResponse.json(
      { offres: [], total: 0, error: `Erreur France Travail (${res.status}): ${txt.slice(0, 200)}` },
      { status: 200 }
    );
  }

  const data = (await res.json()) as {
    resultats?: Record<string, unknown>[];
    Content_Range?: string;
  };

  const resultats = data.resultats ?? [];
  const offres = resultats.map(mapOffre);

  // Total depuis l'en-tête Content-Range (ex: "0-19/4532")
  const contentRange = res.headers.get("Content-Range") ?? "";
  const total = parseInt(contentRange.split("/")[1] ?? "0", 10) || offres.length;

  return NextResponse.json({ offres, total, page });
}
