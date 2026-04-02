/**
 * Service La Bonne Alternance — API apprentissage.beta.gouv.fr v2
 * Nouvelle API unifiée (remplace l'ancienne labonnealternance.apprentissage.beta.gouv.fr/api/V1)
 *
 * Clé API requise : variable d'env LBA_API_KEY
 * Obtenir une clé : https://api.apprentissage.beta.gouv.fr
 */

const LBA_BASE = "https://api.apprentissage.beta.gouv.fr/api";
const TIMEOUT  = 10_000;

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
      if (res.status === 419 && attempt < retries) {
        // Rate-limit (419 = Too Many Requests sur cette API)
        await delay(1_500 * (attempt + 1));
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await delay(600 * (attempt + 1));
    }
  }
  throw lastErr;
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function lbaHeaders(): Record<string, string> {
  const key = process.env.LBA_API_KEY?.trim();
  if (!key) throw new Error("Variable d'env LBA_API_KEY manquante. Obtiens une clé sur https://api.apprentissage.beta.gouv.fr");
  return { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

// ─── Types publics ────────────────────────────────────────────────────────────

/** Entreprise sans offre publiée — candidature spontanée */
export interface LbaRecruteur {
  id:           string;
  recipientId:  string;  // pour POST /job/v1/apply
  siret:        string;
  name:         string;
  address:      string;
  naf:          string;
  nafText:      string;
  size:         string;
  website:      string;
  phone:        string;
  applyUrl:     string;
  score:        number;  // probabilité recrutement alternance (0–1 float ou 1–3 stars)
  type:         "recruteur_lba";
  already_applied?: boolean;
}

/** Offre d'emploi en alternance (LBA directe ou France Travail) */
export interface LbaOffre {
  id:               string;
  recipientId:      string;  // pour POST /job/v1/apply
  partnerLabel:     string;  // "offres_emploi_lba" | "France Travail" | ...
  title:            string;
  companyName:      string;
  siret:            string;
  address:          string;
  contractDuration: number | null;  // mois
  url:              string;
  description:      string;
  romeCodes:        string[];
  type:             "offre_lba" | "offre_partenaire";
  already_applied?: boolean;
}

export interface LbaSearchResult {
  recruteurs:  LbaRecruteur[];
  offres:      LbaOffre[];
  warnings:    { code: string; message: string }[];
}

export interface CandidaturePayload {
  firstName:   string;
  lastName:    string;
  email:       string;
  phone:       string;
  cvBase64:    string;
  cvFileName:  string;
  message?:    string;
}

// ─── Helpers de mapping ───────────────────────────────────────────────────────

function str(v: unknown): string {
  return v != null ? String(v) : "";
}

function mapLocation(loc: Record<string, unknown>): string {
  return str(loc.label ?? loc.address ?? loc.full_address ?? "");
}

function mapWorkplace(wp: Record<string, unknown>): {
  name: string; siret: string; address: string; naf: string; nafText: string; size: string; website: string;
} {
  const loc  = (wp.location  ?? {}) as Record<string, unknown>;
  const dom  = (wp.domain    ?? {}) as Record<string, unknown>;
  const idfs = (wp.identifier ?? {}) as Record<string, unknown>;
  return {
    name:    str(wp.name    ?? wp.brand ?? wp.legal_name),
    siret:   str(wp.siret   ?? idfs.siret),
    address: mapLocation(loc),
    naf:     str(dom.idcc   ?? wp.naf ?? ""),
    nafText: str(dom.label  ?? dom.naf_text ?? ""),
    size:    str(wp.size),
    website: str(wp.website),
  };
}

// ─── Recherche ────────────────────────────────────────────────────────────────

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
  });

  const res = await fetchWithRetry(
    `${LBA_BASE}/job/v1/search?${params}`,
    { headers: lbaHeaders() }
  );

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    let detail = "";
    try { detail = (JSON.parse(txt) as { message?: string }).message ?? txt; } catch { detail = txt; }
    throw new Error(`LBA API ${res.status}: ${detail.slice(0, 200)}`);
  }

  const raw = await res.json() as {
    jobs?:      unknown[];
    recruiters?: unknown[];
    warnings?:  { code: string; message: string }[];
  };

  const recruteurs: LbaRecruteur[] = (raw.recruiters ?? []).map((r) => {
    const item  = r as Record<string, unknown>;
    const id    = (item.identifier ?? {}) as Record<string, unknown>;
    const wp    = (item.workplace   ?? {}) as Record<string, unknown>;
    const apply = (item.apply       ?? {}) as Record<string, unknown>;
    const mapped = mapWorkplace(wp);
    const rawScore = item.establishment_score ?? item.score ?? id.stars ?? id.establishment_score ?? 0;
    return {
      id:          str(id.id),
      recipientId: str(apply.recipient_id),
      ...mapped,
      phone:    str(apply.phone),
      applyUrl: str(apply.url),
      score:    Number(rawScore),
      type:     "recruteur_lba" as const,
    };
  }).sort((a, b) => b.score - a.score);

  const offres: LbaOffre[] = (raw.jobs ?? []).map((j) => {
    const item     = j as Record<string, unknown>;
    const id       = (item.identifier ?? {}) as Record<string, unknown>;
    const wp       = (item.workplace   ?? {}) as Record<string, unknown>;
    const apply    = (item.apply       ?? {}) as Record<string, unknown>;
    const offer    = (item.offer       ?? {}) as Record<string, unknown>;
    const contract = (item.contract    ?? {}) as Record<string, unknown>;
    const mapped   = mapWorkplace(wp);
    const partnerLabel = str(id.partner_label);
    return {
      id:               str(id.id ?? id.partner_job_id),
      recipientId:      str(apply.recipient_id),
      partnerLabel,
      title:            str(offer.title),
      companyName:      mapped.name,
      siret:            mapped.siret,
      address:          mapped.address,
      contractDuration: contract.duration != null ? Number(contract.duration) : null,
      url:              str(apply.url),
      description:      str(offer.description),
      romeCodes:        Array.isArray(offer.rome_codes) ? (offer.rome_codes as string[]) : [],
      type:             partnerLabel === "offres_emploi_lba" ? "offre_lba" : "offre_partenaire",
    };
  });

  return {
    recruteurs,
    offres,
    warnings: raw.warnings ?? [],
  };
}

// ─── Géocodage ────────────────────────────────────────────────────────────────

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

// ─── Envoi de candidature (JSON + base64) ─────────────────────────────────────

export async function sendCandidatureLba(
  recipientId: string,
  payload: CandidaturePayload
): Promise<{ ok: boolean; applicationId?: string; error?: string }> {
  const body = {
    applicant_first_name:        payload.firstName,
    applicant_last_name:         payload.lastName,
    applicant_email:             payload.email,
    applicant_phone:             payload.phone,
    applicant_attachment_name:   payload.cvFileName.endsWith(".pdf") ? payload.cvFileName : `${payload.cvFileName}.pdf`,
    applicant_attachment_content: payload.cvBase64,
    recipient_id:                recipientId,
    ...(payload.message ? { applicant_message: payload.message } : {}),
  };

  try {
    const res = await fetchWithRetry(
      `${LBA_BASE}/job/v1/apply`,
      {
        method:  "POST",
        headers: lbaHeaders(),
        body:    JSON.stringify(body),
      }
    );
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      let detail = "";
      try { detail = (JSON.parse(txt) as { message?: string; error?: string }).message ?? txt; } catch { detail = txt; }
      return { ok: false, error: `LBA ${res.status}: ${detail.slice(0, 200)}` };
    }
    const result = await res.json() as { id?: string };
    return { ok: true, applicationId: result.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erreur réseau LBA" };
  }
}
