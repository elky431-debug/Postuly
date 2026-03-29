import { NextRequest, NextResponse } from "next/server";

/** Toujours exécuter côté serveur (clé secrète). */
export const dynamic = "force-dynamic";

/** Proxy INSEE SIRENE — la clé ne doit jamais être exposée au client. */
const BASE_URL = "https://api.insee.fr/api-sirene/3.11";

const NAF_MAP: Record<string, string[]> = {
  développeur: ["62.01Z", "62.02A", "62.02B", "63.11Z"],
  "développeur web": ["62.01Z", "62.02A", "63.11Z"],
  marketing: ["73.11Z", "73.12Z", "70.22Z"],
  commercial: ["46.90Z", "47.99B", "70.22Z"],
  comptable: ["69.20Z", "66.19B"],
  "ressources humaines": ["78.10Z", "78.20Z", "70.10Z"],
  designer: ["74.10Z", "73.11Z", "62.01Z"],
  data: ["62.01Z", "63.11Z", "72.20Z"],
  restauration: ["56.10A", "56.10B", "56.21Z"],
  vendeur: ["47.11Z", "47.19B", "47.91A"],
  logistique: ["52.10B", "52.29A", "49.41A"],
  default: ["62.01Z", "70.22Z", "73.11Z"],
};

function getNafCodes(secteur: string): string[] {
  const key = secteur.toLowerCase().trim();
  if (!key) return NAF_MAP.default;
  for (const [k, v] of Object.entries(NAF_MAP)) {
    if (k === "default") continue;
    if (key.includes(k)) return v;
  }
  return NAF_MAP.default;
}

async function getCodePostalBan(ville: string): Promise<string[]> {
  const r = await fetch(
    `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(ville)}&type=municipality&limit=10`
  );
  if (!r.ok) return [];
  const data = (await r.json()) as {
    features?: Array<{ properties?: { postcode?: string } }>;
  };
  const raw = data.features?.map((f) => f.properties?.postcode).filter(Boolean) as string[] | undefined;
  if (!raw?.length) return [];
  return [...new Set(raw)];
}

/** Codes postaux : BAN + API Geo (Paris = tous les arrondissements, pas un seul CP). */
async function getCodePostaux(ville: string): Promise<string[]> {
  const trimmed = ville.trim();
  const fromBan = await getCodePostalBan(trimmed);
  try {
    const r = await fetch(
      `https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(trimmed)}&fields=codesPostaux&boost=population&limit=3`
    );
    if (r.ok) {
      const arr = (await r.json()) as Array<{ codesPostaux?: string[] }>;
      const extra = arr.flatMap((c) => c.codesPostaux ?? []);
      const merged = [...new Set([...fromBan, ...extra])];
      if (merged.length) return merged;
    }
  } catch {
    /* ignore */
  }
  return fromBan;
}

/** Clause Lucene : plusieurs codes NAF du secteur (OR), toujours entre guillemets. */
function clauseActivitePrincipaleEtablissement(nafs: string[]): string {
  if (nafs.length === 0) return 'activitePrincipaleEtablissement:"62.01Z"';
  if (nafs.length === 1) return `activitePrincipaleEtablissement:"${nafs[0]}"`;
  const parts = nafs.map((n) => `activitePrincipaleEtablissement:"${n}"`);
  return `(${parts.join(" OR ")})`;
}

function clauseActivitePrincipaleUniteLegale(nafs: string[]): string {
  if (nafs.length === 0) return "activitePrincipaleUniteLegale:62.01Z";
  if (nafs.length === 1) return `activitePrincipaleUniteLegale:${nafs[0]}`;
  const parts = nafs.map((n) => `activitePrincipaleUniteLegale:${n}`);
  return `(${parts.join(" OR ")})`;
}

type InseeEtablissement = {
  siret?: string;
  codePostalEtablissement?: string;
  libelleCommuneEtablissement?: string;
  activitePrincipaleEtablissement?: string;
  periodesEtablissement?: Array<{ activitePrincipaleEtablissement?: string }>;
  libelleActivitePrincipaleEtablissement?: string;
  trancheEffectifsEtablissement?: string;
  dateCreationEtablissement?: string;
  etatAdministratifEtablissement?: string;
  /** Présent sur la réponse complète (sans `champs` restreint). */
  denominationUniteLegale?: string | null;
  nomUniteLegale?: string | null;
  uniteLegale?: {
    denominationUniteLegale?: string | null;
    nomUniteLegale?: string | null;
    prenomUsuelUniteLegale?: string | null;
    trancheEffectifsUniteLegale?: string | null;
  };
};

const tailleLabel: Record<string, string> = {
  NN: "Non renseigné",
  "00": "Micro-entreprise",
  "01": "Micro-entreprise",
  "02": "Micro-entreprise",
  "03": "Micro-entreprise",
  "11": "PME",
  "12": "PME",
  "21": "PME",
  "22": "PME",
  "31": "PME",
  "32": "PME",
  "41": "PME",
  "42": "PME",
  "51": "Grande entreprise",
  "52": "Grande entreprise",
  "53": "Grande entreprise",
};

const PAGE_SIZE = 80;

function apeCourant(e: InseeEtablissement): string {
  const root = (e.activitePrincipaleEtablissement ?? "").trim();
  if (root) return root;
  const p0 = e.periodesEtablissement?.[0];
  return (p0?.activitePrincipaleEtablissement ?? "").trim();
}

export async function GET(req: NextRequest) {
  const key = process.env.INSEE_API_KEY?.trim();
  if (!key) {
    return NextResponse.json(
      { entreprises: [], total: 0, page: 0, error: "Clé INSEE manquante (INSEE_API_KEY dans .env.local)." },
      { status: 503 }
    );
  }
  const inseeKey = key;

  const { searchParams } = new URL(req.url);
  const secteur = searchParams.get("secteur") ?? "";
  const ville = searchParams.get("ville") ?? "";
  const page = Math.max(0, parseInt(searchParams.get("page") ?? "0", 10) || 0);

  if (!ville.trim()) {
    return NextResponse.json({ entreprises: [], total: 0, page, error: "Indique une ville ou un code postal." });
  }

  const codesPostaux = await getCodePostaux(ville.trim());
  if (!codesPostaux.length) {
    return NextResponse.json({ entreprises: [], total: 0, page });
  }

  const nafCodes = getNafCodes(secteur);

  const codePostal = codesPostaux[0]!;
  const ape = clauseActivitePrincipaleEtablissement(nafCodes);
  const apeUl = clauseActivitePrincipaleUniteLegale(nafCodes);
  const dept2 = codePostal.slice(0, 2);
  /** Paris intramuros : wildcard département 75 si le CP seul renvoie peu de lignes. */
  const cpLieu =
    dept2 === "75"
      ? [`codePostalEtablissement:${codePostal}`, `codePostalEtablissement:75*`]
      : [`codePostalEtablissement:${codePostal}`];

  /**
   * Plusieurs NAF en OR (secteur complet), puis repli CP seul avec gros « nombre »
   * pour éviter de tirer 20 établissements au hasard puis filtrer → 0 résultat.
   */
  const queryAttempts: { q: string; postalOnly: boolean; nombre: number }[] = [];
  for (const cpExpr of cpLieu) {
    queryAttempts.push(
      { q: `${cpExpr} AND ${ape} AND etatAdministratifEtablissement:A`, postalOnly: false, nombre: PAGE_SIZE },
      { q: `${cpExpr} AND ${apeUl} AND etatAdministratifEtablissement:A`, postalOnly: false, nombre: PAGE_SIZE },
      { q: `${cpExpr} AND ${ape}`, postalOnly: false, nombre: PAGE_SIZE }
    );
  }
  queryAttempts.push(
    {
      q: `codePostalEtablissement:${codePostal} AND etatAdministratifEtablissement:A`,
      postalOnly: true,
      nombre: 500,
    },
    { q: `codePostalEtablissement:${codePostal}`, postalOnly: true, nombre: 500 }
  );

  let response: Response | null = null;
  let usedPostalOnly = false;

  for (let i = 0; i < queryAttempts.length; i++) {
    const { q, postalOnly, nombre } = queryAttempts[i];
    const url = `${BASE_URL}/siret?q=${encodeURIComponent(q)}&nombre=${nombre}&debut=${page * nombre}`;
    const res = await fetch(url, {
      headers: {
        "X-INSEE-Api-Key-Integration": inseeKey,
        Accept: "application/json",
      },
      next: { revalidate: 0 },
    });
    if (res.ok) {
      response = res;
      usedPostalOnly = postalOnly;
      break;
    }
  }

  if (!response) {
    return NextResponse.json(
      {
        entreprises: [],
        total: 0,
        page,
        error:
          "Impossible d’interroger l’INSEE (toutes les variantes de requête ont échoué). Vérifie la clé INSEE_API_KEY.",
      },
      { status: 200 }
    );
  }

  const data = (await response.json()) as {
    header?: { total?: number; nombre?: number };
    etablissements?: InseeEtablissement[];
  };

  let total = data.header?.total ?? 0;
  let raw = data.etablissements ?? [];

  /* Requête élargie au seul CP : ne garder que les établissements dont le NAF est dans la liste secteur. */
  if (usedPostalOnly) {
    raw = raw.filter((e) => nafCodes.includes(apeCourant(e)));
    total = raw.length;
  }

  const entreprises = raw.map((e) => {
    const apeVal = apeCourant(e);
    const ul = e.uniteLegale ?? {};
    const tranche =
      e.trancheEffectifsEtablissement ??
      ul.trancheEffectifsUniteLegale ??
      e.uniteLegale?.trancheEffectifsUniteLegale ??
      "NN";

    const nom =
      e.denominationUniteLegale?.trim() ||
      ul.denominationUniteLegale?.trim() ||
      [e.nomUniteLegale ?? ul.nomUniteLegale, ul.prenomUsuelUniteLegale].filter(Boolean).join(" ").trim() ||
      "Entreprise inconnue";

    return {
      siret: e.siret ?? "",
      nom,
      ville: e.libelleCommuneEtablissement ?? "",
      codePostal: e.codePostalEtablissement ?? "",
      naf: apeVal,
      libelleNaf: e.libelleActivitePrincipaleEtablissement ?? undefined,
      taille: tailleLabel[tranche] ?? "Non renseigné",
      trancheEffectifs: tranche,
      score: Math.floor(Math.random() * 30) + 70,
      domaine: nafCodes.includes(apeVal) ? secteur || "—" : apeVal || "—",
      selected: false,
      dateCreation: e.dateCreationEtablissement ?? null,
    };
  });

  return NextResponse.json({ entreprises, total, page });
}
