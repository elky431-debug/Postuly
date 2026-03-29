import { NextRequest, NextResponse } from "next/server";
import { nafLabel, NAF_LABELS } from "@/lib/naf-labels";

export const dynamic = "force-dynamic";

const BASE_URL = "https://recherche-entreprises.api.gouv.fr/search";

// ─── NAF mapping : mots-clés → codes valides ────────────────────────────────
// Codes vérifiés NAF 2008 (révision officielle INSEE).
// Règle : "Z" = code unique dans la sous-classe ; lettres = variantes (A, B, C…)

const NAF_MAP: Record<string, string[]> = {
  // ── Tech & numérique
  "développeur web":    ["62.01Z", "62.02A", "63.11Z"],
  "développeur":        ["62.01Z", "62.02A", "62.02B", "63.11Z"],
  "dev web":            ["62.01Z", "62.02A", "63.11Z"],
  "ingénieur":          ["62.01Z", "62.02A", "71.12B", "72.19Z"],
  "informatique":       ["62.01Z", "62.02A", "62.02B", "62.03Z", "62.09Z"],
  "digital":            ["62.01Z", "63.11Z", "73.11Z", "63.12Z"],
  "cyber":              ["62.01Z", "62.09Z", "63.11Z"],
  "data":               ["62.01Z", "63.11Z", "72.19Z"],
  "ia":                 ["62.01Z", "72.19Z", "63.11Z"],
  "cloud":              ["62.01Z", "63.11Z", "62.03Z"],
  "devops":             ["62.01Z", "62.03Z", "63.11Z"],
  "système":            ["62.02A", "62.03Z", "62.09Z"],
  "réseau":             ["62.02A", "61.20Z", "62.09Z"],
  "technicien":         ["62.02B", "62.09Z", "33.12Z"],

  // ── Commerce & vente
  "vendeur":            ["47.19B", "47.99A", "47.11D", "47.91A", "46.90Z"],
  "vente":              ["47.19B", "47.99A", "47.91A", "46.90Z"],
  "commercial":         ["46.90Z", "47.19B", "70.22Z", "82.99Z"],
  "commerce":           ["47.19B", "47.11D", "46.90Z", "47.99A"],
  "boutique":           ["47.19B", "47.25Z", "47.41Z"],
  "retail":             ["47.19B", "47.11D", "47.11F", "47.99A"],
  "grande distribution":["47.11D", "47.11F", "47.19A"],
  "e-commerce":         ["47.91A", "47.91B", "63.12Z"],
  "supermarch":         ["47.11D", "47.11F", "47.19A"],
  "caissier":           ["47.11D", "47.11F", "47.19B"],
  "conseiller vente":   ["47.19B", "47.41Z", "46.90Z"],

  // ── Marketing & communication
  "marketing":          ["73.11Z", "73.12Z", "73.20Z", "70.22Z"],
  "communication":      ["73.11Z", "70.21Z", "59.11B"],
  "publicité":          ["73.11Z", "73.12Z", "74.10Z"],
  "community":          ["73.11Z", "63.12Z", "70.21Z"],
  "seo":                ["73.11Z", "62.01Z", "63.12Z"],
  "content":            ["73.11Z", "63.99Z", "70.21Z"],
  "rédacteur":          ["90.03A", "63.91Z", "73.11Z"],
  "graphiste":          ["74.10Z", "73.11Z", "59.11B"],
  "designer":           ["74.10Z", "73.11Z", "62.01Z"],
  "ux":                 ["74.10Z", "62.01Z", "73.11Z"],
  "motion":             ["74.10Z", "59.11B", "90.01Z"],
  "photographe":        ["74.20Z", "90.01Z"],

  // ── Management & conseil
  "manager":            ["70.22Z", "78.10Z", "70.10Z"],
  "directeur":          ["70.10Z", "70.22Z", "64.19Z"],
  "consultant":         ["70.22Z", "62.02A", "74.90B"],
  "conseil":            ["70.22Z", "62.02A", "74.90B"],
  "chef de projet":     ["70.22Z", "62.01Z", "74.90B"],
  "chef projet":        ["70.22Z", "62.01Z", "74.90B"],
  "business":           ["70.22Z", "46.90Z", "74.90B"],
  "stratégie":          ["70.22Z", "70.10Z", "73.20Z"],
  "audit":              ["69.20Z", "70.22Z", "74.90B"],

  // ── Finance & comptabilité
  "comptable":          ["69.20Z", "66.19B"],
  "comptabilité":       ["69.20Z", "66.19B"],
  "finance":            ["64.19Z", "66.12Z", "69.20Z"],
  "banque":             ["64.19Z", "64.20Z", "64.30Z"],
  "assurance":          ["65.11Z", "65.12Z", "65.20Z"],
  "contrôleur":         ["69.20Z", "70.22Z"],
  "trésorier":          ["69.20Z", "64.19Z"],
  "fiscaliste":         ["69.20Z", "74.90B"],
  "paie":               ["69.20Z", "78.10Z"],

  // ── RH & recrutement
  "ressources humaines":["78.10Z", "78.20Z", "70.10Z"],
  "recrutement":        ["78.10Z", "78.20Z", "74.90B"],
  "rh":                 ["78.10Z", "78.20Z", "70.10Z"],
  "formation":          ["85.59A", "85.59B", "78.10Z"],

  // ── Restauration & hôtellerie
  "restauration":       ["56.10A", "56.10B", "56.21Z"],
  "cuisine":            ["56.10A", "56.10B", "56.29A"],
  "cuisinier":          ["56.10A", "56.10B", "56.29A"],
  "chef":               ["56.10A", "56.21Z", "56.29A"],
  "serveur":            ["56.10A", "56.30Z", "56.10B"],
  "boulangerie":        ["10.71C", "47.24Z"],
  "hôtel":              ["55.10Z", "55.20Z"],
  "tourisme":           ["55.10Z", "79.11Z", "79.12Z"],
  "barman":             ["56.30Z", "56.10B"],

  // ── Logistique & transport
  "logistique":         ["52.10B", "52.29A", "49.41A"],
  "transport":          ["49.41A", "49.41B", "52.29A"],
  "chauffeur":          ["49.41A", "49.32Z", "49.31Z"],
  "livreur":            ["53.20Z", "49.41B", "52.29A"],
  "magasinier":         ["52.10B", "46.90Z"],
  "entrepôt":           ["52.10B", "52.10A"],
  "supply chain":       ["52.29A", "52.29B", "46.90Z"],

  // ── Bâtiment & travaux
  "btp":                ["41.20A", "41.20B", "43.29A"],
  "bâtiment":           ["41.20A", "41.20B", "43.22A"],
  "electricien":        ["43.21A", "43.21B"],
  "plombier":           ["43.22A", "43.22B"],
  "maçon":              ["41.20A", "43.99A"],
  "architecte":         ["71.11Z"],
  "immobilier":         ["68.31Z", "68.10Z", "41.10A"],
  "agent immobilier":   ["68.31Z", "68.20A"],
  "promotion immob":    ["41.10A", "41.10B"],

  // ── Santé
  "médecin":            ["86.21Z", "86.22A"],
  "infirmier":          ["86.90A", "86.90B"],
  "pharmacie":          ["47.73Z", "46.46Z"],
  "kiné":               ["86.90A"],
  "santé":              ["86.10Z", "86.21Z", "86.90B"],

  // ── Éducation
  "enseignant":         ["85.31Z", "85.20Z", "85.42Z"],
  "professeur":         ["85.31Z", "85.20Z", "85.42Z"],
  "formateur":          ["85.59A", "85.59B"],
  "éducation":          ["85.10Z", "85.20Z", "85.31Z"],

  // ── Sport & loisirs
  "sport":              ["93.11Z", "93.12Z", "93.13Z", "93.19Z", "47.64Z"],
  "fitness":            ["93.13Z", "93.11Z"],
  "salle de sport":     ["93.13Z", "93.11Z"],
  "coach sportif":      ["93.13Z", "85.51Z"],
  "club sportif":       ["93.12Z", "93.11Z"],
  "piscine":            ["93.11Z", "93.19Z"],
  "terrain":            ["93.11Z", "41.20A"],
  "loisirs":            ["93.19Z", "93.29Z", "79.90Z"],
  "animation":          ["93.29Z", "85.51Z", "90.01Z"],
  "événementiel":       ["82.30Z", "90.01Z", "93.29Z"],
  "événement":          ["82.30Z", "90.01Z"],

  // ── Beauté & bien-être
  "coiffeur":           ["96.02A"],
  "coiffure":           ["96.02A"],
  "esthéticienne":      ["96.02B"],
  "esthétique":         ["96.02B"],
  "salon de beauté":    ["96.02B", "96.02A"],
  "spa":                ["96.04Z", "96.02B"],
  "massage":            ["96.04Z", "86.90A"],
  "bien-être":          ["96.04Z", "96.02B", "86.90A"],

  // ── Artisanat du bâtiment
  "menuisier":          ["43.32A", "16.23Z"],
  "menuiserie":         ["43.32A", "16.23Z"],
  "plomberie":          ["43.22A", "43.22B"],
  "chauffagiste":       ["43.22A", "43.22B"],
  "électricité":        ["43.21A", "43.21B"],
  "peintre":            ["43.34Z"],
  "peinture":           ["43.34Z"],
  "carreleur":          ["43.33Z"],
  "carrelage":          ["43.33Z"],
  "plâtrier":           ["43.31Z"],
  "isolation":          ["43.29A", "43.29B"],
  "couvreur":           ["43.91A", "43.91B"],
  "toiture":            ["43.91A", "43.91B"],
  "façade":             ["43.34Z", "43.99A"],
  "paysagiste":         ["81.30Z"],
  "jardinier":          ["81.30Z"],
  "jardinage":          ["81.30Z"],
  "nettoyage":          ["81.21Z", "81.22Z", "81.29B"],
  "entretien":          ["81.10Z", "81.21Z", "43.21A"],
  "rénovation":         ["41.20A", "43.29A", "43.34Z"],
  "construction":       ["41.20A", "41.20B", "43.99A"],

  // ── Alimentation & épicerie
  "boucherie":          ["47.22Z", "10.11Z"],
  "boucher":            ["47.22Z", "10.11Z"],
  "épicerie":           ["47.11C", "47.11D"],
  "traiteur":           ["56.21Z", "10.85Z"],
  "pâtisserie":         ["47.24Z", "10.71D"],
  "pâtissier":          ["47.24Z", "10.71D"],
  "cave à vin":         ["47.25Z"],
  "fromagerie":         ["47.29Z", "10.51C"],
  "poissonnerie":       ["47.23Z"],
  "marché":             ["47.81Z", "47.89Z"],
  "alimentation":       ["47.11D", "47.11C", "10.85Z"],

  // ── Mode & textile
  "habillement":        ["47.71Z", "47.72A"],
  "vêtements":          ["47.71Z", "14.13Z"],
  "mode":               ["47.71Z", "74.10Z", "14.13Z"],
  "chaussures":         ["47.72A", "47.72B"],
  "bijouterie":         ["47.77Z", "32.12Z"],

  // ── Automobile
  "garage":             ["45.20A", "45.20B"],
  "mécanicien":         ["45.20A", "45.20B"],
  "automobile":         ["45.11Z", "45.20A", "77.11A"],
  "carrosserie":        ["45.20B"],
  "concessionnaire":    ["45.11Z", "45.19Z"],
  "location voiture":   ["77.11A"],
  "moto":               ["45.40Z"],

  // ── Juridique & notariat
  "avocat":             ["69.10Z"],
  "notaire":            ["69.10Z"],
  "huissier":           ["69.10Z"],
  "juridique":          ["69.10Z"],
  "droit":              ["69.10Z", "85.42Z"],

  // ── Immobilier (compléments)
  "syndic":             ["68.32A"],
  "copropriété":        ["68.32A"],
  "gestion locative":   ["68.20A", "68.32A"],
  "diagnostiqueur":     ["71.20A"],

  // ── High-tech & électronique
  "téléphone":          ["47.42Z", "61.20Z"],
  "réparation mobile":  ["95.12Z"],
  "électroménager":     ["47.54Z", "95.22Z"],
  "hi-fi":              ["47.43Z"],

  // ── Médias & culture
  "librairie":          ["47.61Z"],
  "livre":              ["47.61Z", "58.11Z"],
  "musée":              ["91.02Z"],
  "galerie art":        ["90.04Z"],
  "presse":             ["63.91Z", "58.14Z"],
  "podcast":            ["60.10Z", "59.20Z"],
  "musique":            ["90.01Z", "59.20Z"],
  "cinéma":             ["59.14Z", "59.11A"],
  "théâtre":            ["90.01Z"],
  "jeux vidéo":         ["62.01Z", "58.21Z"],
  "jeu vidéo":          ["62.01Z", "58.21Z"],

  // ── Services à la personne
  "aide à domicile":    ["88.10A", "88.10B"],
  "garde enfant":       ["88.91A", "88.91B"],
  "crèche":             ["88.91A"],
  "baby-sitter":        ["88.91B", "97.00Z"],
  "femme de ménage":    ["97.00Z", "81.21Z"],
  "déménagement":       ["49.42Z"],

  // ── Impression & papeterie
  "imprimerie":         ["18.12Z", "18.11Z"],
  "papeterie":          ["47.62Z"],

  // ── Sécurité
  "sécurité":           ["80.10Z", "80.20Z", "80.30Z"],
  "gardiennage":        ["80.10Z"],
  "alarme":             ["80.20Z", "43.21A"],

  // ── Divers manquants
  "fleuriste":          ["47.76Z"],
  "fleurs":             ["47.76Z"],
  "vétérinaire":        ["75.00Z"],
  "animaux":            ["75.00Z", "47.76Z"],
  "optique":            ["47.78A", "86.22C"],
  "opticien":           ["47.78A"],
  "bijoux":             ["47.77Z", "32.12Z"],
  "horlogerie":         ["47.77Z"],
  "jouets":             ["47.65Z"],
  "jeux":               ["47.65Z", "93.29Z"],
  "location":           ["77.11A", "77.21Z", "68.20A"],
  "nettoyage industriel":["81.22Z"],
  "pressing":           ["96.01A", "96.01B"],
  "pompes funèbres":    ["96.03Z"],
  "funéraire":          ["96.03Z"],
  "ambulance":          ["86.90A", "86.10Z"],
  "taxi":               ["49.32Z"],
  "vtc":                ["49.32Z"],
  "coursier":           ["53.20Z", "49.41B"],
  "drone":              ["62.01Z", "74.20Z"],
  "energie":            ["35.11Z", "35.14Z", "43.21A"],
  "solaire":            ["35.11Z", "43.29A"],
  "environnement":      ["37.00Z", "38.11Z", "71.20B"],
  "agriculture":        ["01.11Z", "01.30Z", "01.50Z"],
  "viticulteur":        ["01.21Z", "11.02A"],
  "viticulture":        ["01.21Z", "11.02A"],
  "maraîcher":          ["01.13Z"],
  "élevage":            ["01.41Z", "01.42Z", "01.46Z"],
  "chasse":             ["01.70Z"],
  "pêche":              ["03.11Z", "03.12Z"],
};
// ─── Tranche effectifs → libellé ─────────────────────────────────────────────

const TRANCHE_LABELS: Record<string, string> = {
  "00": "0 sal.",
  "01": "1-2 sal.",
  "02": "3-5 sal.",
  "03": "6-9 sal.",
  "11": "10-19 sal.",
  "12": "20-49 sal.",
  "21": "50-99 sal.",
  "22": "100-199 sal.",
  "31": "200-249 sal.",
  "32": "250-499 sal.",
  "41": "500-999 sal.",
  "42": "1 000-1 999 sal.",
  "51": "2 000-4 999 sal.",
  "52": "5 000-9 999 sal.",
  "53": "10 000+ sal.",
  NN: "Non renseigné",
};

// ─── Taille (catégorie légale + tranche) → libellé ───────────────────────────

const TAILLE_FROM_TRANCHE: Record<string, string> = {
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
  NN: "Non renseigné",
};

function categorieTaille(
  categorie: string | null | undefined,
  tranche: string | null | undefined
): string {
  // La tranche effectifs est la source la plus fiable pour le headcount
  if (tranche && tranche !== "NN") return TAILLE_FROM_TRANCHE[tranche] ?? "Non renseigné";
  // Fallback sur la catégorie légale (peut être basée sur le CA, pas le headcount)
  if (categorie === "GE") return "Grande entreprise";
  if (categorie === "ETI") return "Grande entreprise";
  if (categorie === "PME") return "PME";
  return "Non renseigné";
}

// ─── Score basé sur des critères réels ───────────────────────────────────────

function computeScore(params: {
  nafMatch: boolean;
  tranche: string | null | undefined;
  dateCreation: string | null | undefined;
  categorie: string | null | undefined;
}): number {
  let score = 30;

  // +20 si le code NAF correspond exactement au secteur recherché
  if (params.nafMatch) score += 20;

  // +15 si l'entreprise a des effectifs connus et > 0
  const tranche = params.tranche ?? "NN";
  if (tranche !== "NN" && tranche !== "00") score += 15;

  // +10 si entreprise récente (créée < 8 ans)
  if (params.dateCreation) {
    const age =
      new Date().getFullYear() - new Date(params.dateCreation).getFullYear();
    if (age <= 8) score += 10;
  }

  // +10 si PME ou plus (structure établie)
  if (params.categorie === "PME" || params.categorie === "ETI" || params.categorie === "GE") {
    score += 10;
  }

  // +5 si effectif entre 10 et 499 (ni micro-entreprise isolée, ni grand groupe)
  const mid = ["11", "12", "21", "22", "31", "32"];
  if (mid.includes(tranche)) score += 5;

  return Math.min(score, 100);
}

// ─── Geo helpers ─────────────────────────────────────────────────────────────

type CityInfo = {
  departement: string | null;
  codePostal: string | null;
  lat: number | null;
  lon: number | null;
};

async function getCityInfo(adresse: string): Promise<CityInfo> {
  let departement: string | null = null;
  let codePostal: string | null = null;
  let lat: number | null = null;
  let lon: number | null = null;

  try {
    // BAN gère tout : adresse complète, ville seule, code postal
    const banRes = await fetch(
      `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(adresse)}&limit=1`
    );

    if (banRes.ok) {
      const data = (await banRes.json()) as {
        features?: Array<{
          properties?: { postcode?: string; context?: string };
          geometry?: { coordinates?: [number, number] };
        }>;
      };
      const feat = data.features?.[0];
      codePostal = feat?.properties?.postcode ?? null;
      // context = "75, Paris, Île-de-France" → premier segment = code dept
      const ctx = feat?.properties?.context ?? "";
      departement = ctx.split(",")[0]?.trim() || null;
      const coords = feat?.geometry?.coordinates;
      if (coords) {
        lon = coords[0];
        lat = coords[1];
      }
    }
  } catch {
    /* ignore */
  }

  // Fallback département depuis code postal
  if (!departement && codePostal) {
    departement = codePostal.startsWith("97") ? codePostal.slice(0, 3) : codePostal.slice(0, 2);
  }

  return { departement, codePostal, lat, lon };
}

/** Distance en km entre deux points GPS (formule de Haversine). */
function distanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Types API ────────────────────────────────────────────────────────────────

type Etablissement = {
  siret?: string;
  code_postal?: string;
  libelle_commune?: string;
  activite_principale?: string;
  latitude?: string | null;
  longitude?: string | null;
  adresse?: string;
  tranche_effectif_salarie?: string | null;
  etat_administratif?: string;
};

type RechercheResult = {
  siren?: string;
  nom_complet?: string;
  nom_raison_sociale?: string;
  categorie_entreprise?: string | null;
  tranche_effectif_salarie?: string | null;
  date_creation?: string | null;
  activite_principale?: string;
  etat_administratif?: string;
  siege?: Etablissement;
  matching_etablissements?: Etablissement[];
};

const PAGE_SIZE = 25;

// ─── Cache NAF LLM (évite de rappeler l'IA pour un même terme) ───────────────
const nafLlmCache = new Map<string, { codes: string[] | null; ts: number }>();
const NAF_CACHE_TTL = 1000 * 60 * 60 * 24; // 24h

/** Résout un terme libre → codes NAF via Claude Haiku. Retourne null si échec. */
async function getNafCodesFromLLM(secteur: string): Promise<string[] | null> {
  const key = secteur.toLowerCase().trim();

  // On ne cache que les succès — jamais les échecs (clé absente, timeout, etc.)
  const cached = nafLlmCache.get(key);
  if (cached && Date.now() - cached.ts < NAF_CACHE_TTL) return cached.codes;

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return null;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 80,
        messages: [
          {
            role: "user",
            content: `Nomenclature NAF 2008 française. Pour le terme "${secteur}", donne les codes NAF les plus pertinents (3 à 6 max). Réponds UNIQUEMENT avec un JSON array valide, rien d'autre. Exemple: ["73.11Z","73.12Z","70.22Z"]`,
          },
        ],
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return null; // pas de cache sur erreur API

    const data = (await res.json()) as {
      content?: Array<{ text?: string }>;
    };
    const text = data.content?.[0]?.text?.trim() ?? "";
    const match = text.match(/\[[\s\S]*?\]/);
    if (!match) return null;

    const codes: unknown = JSON.parse(match[0]);
    if (!Array.isArray(codes) || codes.length === 0) return null;

    // Validation : format correct ET code existant dans NAF 2008
    const valid = (codes as unknown[])
      .filter((c): c is string =>
        typeof c === "string" &&
        /^\d{2}\.\d{2}[A-Z]$/.test(c) &&
        c in NAF_LABELS  // rejette les codes inventés par le LLM
      );

    if (valid.length === 0) return null;

    // Mise en cache uniquement si on a des codes valides
    nafLlmCache.set(key, { codes: valid, ts: Date.now() });
    return valid;
  } catch {
    return null; // timeout ou erreur réseau → pas de cache, on réessaie la prochaine fois
  }
}

/** Fallback local : NAF_MAP + fuzzy matching, sans appel réseau. */
function getNafCodesLocal(secteur: string): string[] | null {
  const norm = (s: string) =>
    s.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const key = norm(secteur);
  if (!key) return null;

  const entries = Object.entries(NAF_MAP).sort((a, b) => b[0].length - a[0].length);

  for (const [k, v] of entries) {
    const kn = norm(k);
    if (key === kn || key.includes(kn) || kn.includes(key)) return v;
  }

  const words = key.split(/[\s\-_/,]+/).filter((w) => w.length > 2);
  for (const word of words) {
    for (const [k, v] of entries) {
      if (norm(k).split(/\s+/).includes(word)) return v;
    }
  }

  const PREFIX_LEN = 5;
  for (const word of words) {
    if (word.length < PREFIX_LEN) continue;
    for (const [k, v] of entries) {
      for (const kw of norm(k).split(/\s+/)) {
        if (kw.length < PREFIX_LEN) continue;
        const len = Math.min(word.length, kw.length, 6);
        if (word.slice(0, len) === kw.slice(0, len)) return v;
      }
    }
  }

  return null;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const secteur = searchParams.get("secteur") ?? "";
  const ville = searchParams.get("ville") ?? "";
  const page = Math.max(1, (parseInt(searchParams.get("page") ?? "0", 10) || 0) + 1);
  const taillesParam = searchParams.get("tailles") ?? "tpe,pme,grande";
  const rayonKm = Math.max(1, parseFloat(searchParams.get("rayon") ?? "15") || 15);

  if (!ville.trim()) {
    return NextResponse.json({
      entreprises: [],
      total: 0,
      page: 0,
      error: "Indique une ville ou un code postal.",
    });
  }

  // 1. Essai LLM (Claude Haiku) — rapide, précis, mis en cache 24h
  // 2. Fallback NAF_MAP local si l'IA est indisponible ou clé absente
  let nafCodes: string[] | null = secteur.trim()
    ? await getNafCodesFromLLM(secteur.trim())
    : null;

  if (nafCodes === null && secteur.trim()) {
    nafCodes = getNafCodesLocal(secteur.trim());
  }

  const cityInfo = await getCityInfo(ville.trim());
  const { departement, codePostal, lat: cityLat, lon: cityLon } = cityInfo;

  if (!departement && !codePostal) {
    return NextResponse.json({ entreprises: [], total: 0, page: 0, error: "Ville introuvable." });
  }

  const taillesSet = new Set(taillesParam.split(",").map((t) => t.trim()));
  const categoriesWanted: string[] = [];
  const includeNonRenseigne = taillesSet.has("tpe");
  if (taillesSet.has("grande")) categoriesWanted.push("ETI", "GE");
  if (taillesSet.has("pme")) categoriesWanted.push("PME");

  // Pour couvrir le rayon, on fetch suffisamment de résultats côté API puis on filtre localement.
  // On demande plus de résultats que PAGE_SIZE pour compenser les filtrages rayon côté serveur.
  const fetchSize = Math.min(25, PAGE_SIZE);

  const params = new URLSearchParams({
    per_page: String(fetchSize),
    page: String(page),
    etat_administratif: "A",
  });

  // Filtre NAF si codes reconnus, sinon recherche textuelle dans les noms
  if (nafCodes && nafCodes.length > 0) {
    params.set("activite_principale", nafCodes.join(","));
  } else if (secteur.trim()) {
    params.set("q", secteur.trim().slice(0, 50));
  }

  if (departement) params.set("departement", departement);
  else if (codePostal) params.set("code_postal", codePostal);

  const allTailles = taillesSet.has("tpe") && taillesSet.has("pme") && taillesSet.has("grande");
  if (!allTailles && categoriesWanted.length > 0) {
    params.set("categorie_entreprise", categoriesWanted.join(","));
  }

  const res = await fetch(`${BASE_URL}?${params.toString()}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    return NextResponse.json(
      {
        entreprises: [],
        total: 0,
        page: 0,
        error: `Erreur API entreprises (${res.status}): ${txt.slice(0, 200)}`,
      },
      { status: 200 }
    );
  }

  const data = (await res.json()) as {
    total_results?: number;
    total_pages?: number;
    results?: RechercheResult[];
  };

  let results = data.results ?? [];

  // Fusion TPE si nécessaire
  if (!allTailles && includeNonRenseigne && categoriesWanted.length > 0) {
    const params2 = new URLSearchParams(params.toString());
    params2.delete("categorie_entreprise");
    const res2 = await fetch(`${BASE_URL}?${params2.toString()}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
    });
    if (res2.ok) {
      const data2 = (await res2.json()) as { results?: RechercheResult[] };
      const merged = [...results, ...(data2.results ?? [])];
      const seen = new Set<string>();
      results = merged.filter((r) => {
        const id = r.siren ?? "";
        if (seen.has(id)) return false;
        seen.add(id);
        const cat = r.categorie_entreprise;
        return categoriesWanted.includes(cat ?? "") || (includeNonRenseigne && !cat);
      });
    }
  }

  const entreprises = results.flatMap((r) => {
    const siren = r.siren ?? "";
    const matchingEtabs = r.matching_etablissements ?? [];
    const allEtabs: Etablissement[] = matchingEtabs.length > 0 ? matchingEtabs : (r.siege ? [r.siege] : []);

    // Candidats avec coordonnées GPS → filtre rayon réel
    const avecCoords: Array<{ etab: Etablissement; distKm: number }> = [];
    const sansCoords: Etablissement[] = [];

    for (const etab of allEtabs) {
      const eLat = etab.latitude ? parseFloat(etab.latitude) : null;
      const eLon = etab.longitude ? parseFloat(etab.longitude) : null;

      if (eLat !== null && !isNaN(eLat) && eLon !== null && !isNaN(eLon) && cityLat !== null && cityLon !== null) {
        const d = distanceKm(cityLat, cityLon, eLat, eLon);
        if (d <= rayonKm) avecCoords.push({ etab, distKm: d });
      } else {
        sansCoords.push(etab);
      }
    }

    let localEtab: Etablissement;

    if (avecCoords.length > 0) {
      // Prendre l'établissement le plus proche dans le rayon
      avecCoords.sort((a, b) => a.distKm - b.distKm);
      localEtab = avecCoords[0].etab;
    } else if (sansCoords.length > 0) {
      // Pas de GPS disponible → garder quand même (on fait confiance au filtre département API)
      localEtab = sansCoords[0];
    } else {
      // Aucun établissement dans le rayon → exclure
      return [];
    }

    const nafVal = localEtab.activite_principale ?? r.activite_principale ?? "";
    const tranche = localEtab.tranche_effectif_salarie ?? r.tranche_effectif_salarie ?? null;

    return [{
      siret: localEtab.siret ?? siren,
      siren,
      nom: r.nom_complet?.trim() || r.nom_raison_sociale?.trim() || "Entreprise inconnue",
      ville: localEtab.libelle_commune ?? "",
      codePostal: localEtab.code_postal ?? "",
      naf: nafVal,
      libelleNaf: nafLabel(nafVal),
      taille: categorieTaille(r.categorie_entreprise, tranche),
      trancheEffectifs: tranche ?? "NN",
      effectifLabel: TRANCHE_LABELS[tranche ?? "NN"] ?? "Non renseigné",
      score: computeScore({
        nafMatch: nafCodes ? nafCodes.includes(nafVal) : false,
        tranche,
        dateCreation: r.date_creation,
        categorie: r.categorie_entreprise,
      }),
      // Afficher le NAF de l'entreprise (filtré) plutôt que celui de l'établissement
      domaine: nafLabel(r.activite_principale ?? nafVal),
      selected: false,
      dateCreation: r.date_creation ?? null,
      adresse: localEtab.adresse ?? null,
      annuaireUrl: siren ? `https://annuaire-entreprises.data.gouv.fr/entreprise/${siren}` : null,
      rechercheWebUrl: `https://www.google.com/search?q=${encodeURIComponent((r.nom_complet ?? r.nom_raison_sociale ?? "") + " site officiel")}`,
    }];
  });

  return NextResponse.json({
    entreprises,
    total: data.total_results ?? entreprises.length,
    page: page - 1,
    totalPages: data.total_pages ?? 1,
  });
}
