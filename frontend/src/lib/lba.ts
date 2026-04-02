/**
 * Service La Bonne Alternance (LBA)
 * API officielle gouvernement français — aucune clé requise, usage non lucratif.
 * https://labonnealternance.apprentissage.beta.gouv.fr
 */

const LBA_BASE = "https://labonnealternance.apprentissage.beta.gouv.fr";
const CALLER   = "postuly";
const TIMEOUT  = 8_000;

// ─── Retry ────────────────────────────────────────────────────────────────────

async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries = 2
): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(TIMEOUT),
      });
      // Rate-limit → back off puis réessaye
      if (res.status === 429 && attempt < retries) {
        await delay(1_000 * (attempt + 1));
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await delay(500 * (attempt + 1));
    }
  }
  throw lastErr;
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Types publics ────────────────────────────────────────────────────────────

export type LbaJobType = "recruteur_lba" | "offre_lba" | "offre_partenaire";

/** Entreprise identifiée par algo LBA — pas d'offre publiée, candidature spontanée. */
export interface LbaRecruteur {
  id: string;
  siret: string;
  name: string;
  address: string;
  naf: string;
  nafText: string;
  distance: number;
  url: string;
  type: "recruteur_lba";
  contactEmail?: string;
  contactPhone?: string;
  already_applied?: boolean;
}

/** Offre d'emploi LBA directe ou partenaire France Travail. */
export interface LbaOffre {
  id: string;
  title: string;
  companyName: string;
  siret?: string;
  city: string;
  address?: string;
  url: string;
  description?: string;
  contractDuration?: string;
  type: "offre_lba" | "offre_partenaire";
  contactEmail?: string;
  already_applied?: boolean;
}

export interface LbaSearchResult {
  recruteurs: LbaRecruteur[];
  offres_lba: LbaOffre[];
  offres_partenaires: LbaOffre[];
}

export interface CandidaturePayload {
  firstName: string;
  lastName:  string;
  email:     string;
  phone:     string;
  cvBlob:    Blob;
  cvFileName: string;
  message?:  string;
}

// ─── Helpers de mapping (structure API peut varier) ───────────────────────────

function toArr(v: unknown): unknown[] {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  const results = (v as { results?: unknown }).results;
  return Array.isArray(results) ? results : [];
}

function str(v: unknown): string {
  return v != null ? String(v) : "";
}

// ─── Recherche d'opportunités ─────────────────────────────────────────────────

export async function searchOpportunites(
  rome: string,
  lat: number,
  lng: number,
  radius = 30
): Promise<LbaSearchResult> {
  const params = new URLSearchParams({
    romes:     rome,
    latitude:  String(lat),
    longitude: String(lng),
    radius:    String(radius),
    caller:    CALLER,
  });

  const res = await fetchWithRetry(`${LBA_BASE}/api/V1/jobs?${params}`);

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`LBA API ${res.status}: ${txt.slice(0, 200)}`);
  }

  const raw = await res.json() as {
    lbaCompanies?: unknown;
    matchas?:      unknown;
    peJobs?:       unknown;
  };

  // ── Recruteurs LBA ──
  const recruteurs: LbaRecruteur[] = toArr(raw.lbaCompanies).map((c) => {
    const item    = c as Record<string, unknown>;
    const co      = (item.company ?? {})                     as Record<string, unknown>;
    const addr    = (co.address ?? co.headquartersAdress ?? {}) as Record<string, unknown>;
    const contact = (item.contact ?? {})                     as Record<string, unknown>;
    return {
      id:           str(item._id ?? co.siret),
      siret:        str(co.siret),
      name:         str(co.name),
      address:      str(addr.label ?? addr.street ?? addr.fullAddress),
      naf:          str(co.naf),
      nafText:      str(co.nafText ?? co.nafLabel),
      distance:     Number(item.distance ?? 0),
      url:          str(item.url),
      type:         "recruteur_lba",
      contactEmail: str(contact.email) || undefined,
      contactPhone: str(contact.phone) || undefined,
    };
  });

  // ── Offres LBA directes (matchas) ──
  const offres_lba: LbaOffre[] = toArr(raw.matchas).map((o) => {
    const item     = o as Record<string, unknown>;
    const co       = (item.company  ?? {}) as Record<string, unknown>;
    const place    = (item.place    ?? {}) as Record<string, unknown>;
    const contact  = (item.contact  ?? {}) as Record<string, unknown>;
    const contract = (item.contract ?? {}) as Record<string, unknown>;
    return {
      id:               str(item._id),
      title:            str(item.title) || "Offre en alternance",
      companyName:      str(co.name),
      siret:            str(co.siret) || undefined,
      city:             str(place.city),
      address:          str(place.fullAddress) || undefined,
      url:              str(item.url),
      description:      str(item.description) || undefined,
      contractDuration: str(contract.duration) || undefined,
      type:             "offre_lba",
      contactEmail:     str(contact.email) || undefined,
    };
  });

  // ── Offres partenaires France Travail (peJobs) ──
  const offres_partenaires: LbaOffre[] = toArr(raw.peJobs).map((o) => {
    const item  = o as Record<string, unknown>;
    const co    = (item.company  ?? {}) as Record<string, unknown>;
    const place = (item.place ?? item.location ?? {}) as Record<string, unknown>;
    return {
      id:          str(item.id ?? item._id),
      title:       str(item.title) || "Offre partenaire",
      companyName: str(co.name),
      city:        str(place.city ?? place.libelle),
      url:         str(item.url),
      description: str(item.description) || undefined,
      type:        "offre_partenaire",
    };
  });

  return { recruteurs, offres_lba, offres_partenaires };
}

// ─── Géocodage (API adresse gouvernement) ────────────────────────────────────

export async function geocodeCity(
  city: string
): Promise<{ lat: number; lng: number; label: string } | null> {
  try {
    const res = await fetch(
      `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(city)}&type=municipality&limit=1`,
      { signal: AbortSignal.timeout(5_000) }
    );
    if (!res.ok) return null;
    const data = await res.json() as {
      features?: Array<{
        geometry:   { coordinates: [number, number] };
        properties: { label: string };
      }>;
    };
    const f = data.features?.[0];
    if (!f) return null;
    const [lng, lat] = f.geometry.coordinates;
    return { lat, lng, label: f.properties.label };
  } catch {
    return null;
  }
}

// ─── Envoi de candidature ─────────────────────────────────────────────────────

export async function sendCandidatureLba(
  jobId: string,
  payload: CandidaturePayload
): Promise<{ ok: boolean; error?: string }> {
  const fd = new FormData();
  fd.append("firstName", payload.firstName);
  fd.append("lastName",  payload.lastName);
  fd.append("email",     payload.email);
  fd.append("phone",     payload.phone);
  if (payload.message) fd.append("message", payload.message);
  fd.append("cv", payload.cvBlob, payload.cvFileName);

  try {
    const res = await fetchWithRetry(
      `${LBA_BASE}/api/V1/application/job/${encodeURIComponent(jobId)}?caller=${CALLER}`,
      { method: "POST", body: fd }
    );
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { ok: false, error: `LBA ${res.status}: ${txt.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erreur réseau LBA" };
  }
}
