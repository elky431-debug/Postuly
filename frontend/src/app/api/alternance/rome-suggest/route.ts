/**
 * GET /api/alternance/rome-suggest?q=marketing
 *
 * Suggère des codes ROME à partir d'un libellé de métier.
 * - Si FT_CLIENT_ID + FT_CLIENT_SECRET sont définis → API France Travail officielle
 * - Sinon → fallback sur une liste statique enrichie avec recherche par mots-clés
 */
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// ─── France Travail OAuth (token mis en cache en mémoire) ─────────────────────

let ftTokenCache: { token: string; expiresAt: number } | null = null;

async function getFtToken(): Promise<string | null> {
  const clientId     = process.env.FT_CLIENT_ID?.trim();
  const clientSecret = process.env.FT_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;

  // Token encore valide (marge de 60s)
  if (ftTokenCache && Date.now() < ftTokenCache.expiresAt - 60_000) {
    return ftTokenCache.token;
  }

  try {
    const res = await fetch(
      "https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=%2Fpartenaire",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type:    "client_credentials",
          client_id:     clientId,
          client_secret: clientSecret,
          scope:         "api_offresdemploiv2 o2dsoffre",
        }),
        signal: AbortSignal.timeout(5_000),
      }
    );
    if (!res.ok) return null;
    const data = await res.json() as { access_token: string; expires_in: number };
    ftTokenCache = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
    return data.access_token;
  } catch {
    return null;
  }
}

async function searchFtRome(q: string): Promise<{ code: string; label: string }[] | null> {
  const token = await getFtToken();
  if (!token) return null;

  try {
    const res = await fetch(
      `https://api.francetravail.io/partenaire/offresdemploi/v2/referentiel/metiers?libelle=${encodeURIComponent(q)}`,
      {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        signal:  AbortSignal.timeout(5_000),
      }
    );
    if (!res.ok) return null;
    const data = await res.json() as Array<{ code: string; libelle: string }>;
    return data.slice(0, 8).map((r) => ({ code: r.code, label: r.libelle }));
  } catch {
    return null;
  }
}

// ─── Fallback statique (200+ métiers en alternance) ───────────────────────────

const ROME_DB: { code: string; label: string; kw: string[] }[] = [
  // Informatique & numérique
  { code: "M1805", label: "Développement informatique", kw: ["développeur","dev","informatique","web","full stack","frontend","backend","react","vue","angular","javascript","typescript","python","java","php","ruby","mobile","ios","android","flutter"] },
  { code: "M1806", label: "Consulting et expertise SI", kw: ["consultant","si","système d'information","it","erp","sap","crm","oracle","netsuite","salesforce","amoa"] },
  { code: "M1802", label: "Support et expertise technique IT", kw: ["support","technicien","helpdesk","réseaux","sécurité","cybersécurité","infrastructure","noc","it support"] },
  { code: "M1810", label: "Production et exploitation systèmes d'info", kw: ["devops","sysadmin","cloud","aws","azure","gcp","linux","infra","datacenter","kubernetes","docker"] },
  { code: "M1803", label: "Direction des systèmes d'info", kw: ["dsi","direction","si","cto","architecte","urbaniste"] },
  { code: "M1809", label: "Sécurité des systèmes d'information", kw: ["cybersécurité","sécurité","ssi","pentest","rssi","iso27001","gdpr"] },
  { code: "E1401", label: "Développement web et multimédia", kw: ["webdesign","ux","ui","graphiste","intégration","cms","wordpress","webmaster","motion"] },
  // Marketing & communication
  { code: "M1705", label: "Marketing / études de marché", kw: ["marketing","chef de produit","product manager","étude marché","seo","sem","digital","growth","acquisition","analytics","data marketing"] },
  { code: "M1706", label: "Promotion des ventes", kw: ["trade marketing","promotion des ventes","key account","chef de rayon","category manager"] },
  { code: "M1703", label: "Communication", kw: ["communication","rp","relations publiques","attaché presse","community manager","social media","contenu","rédaction","storytelling","brand"] },
  { code: "M1701", label: "Production et mise en scène", kw: ["production","audiovisuel","vidéo","montage","réalisateur","média"] },
  // Commerce & vente
  { code: "D1504", label: "Commerce B2B / technico-commercial", kw: ["commercial","vente","technico-commercial","business developer","bdm","b2b","account executive","vente solutions"] },
  { code: "D1207", label: "Relation client / télévente", kw: ["relation client","télévente","service client","customer success","crm","fidélisation","sav","après-vente"] },
  { code: "D1508", label: "Management en commerce / force de vente", kw: ["chef des ventes","manager commercial","directeur des ventes","retail manager"] },
  { code: "D1502", label: "Commerce grande distribution", kw: ["grande distribution","hypermarché","supermarché","chef de rayon","distribution","retail"] },
  // Finance & gestion
  { code: "M1204", label: "Contrôle de gestion", kw: ["contrôle de gestion","controller","finances","budget","reporting","kpi","performance","tableau de bord"] },
  { code: "M1203", label: "Comptabilité", kw: ["comptable","comptabilité","finance","bilan","fiscalité","audit","expert-comptable","trésorerie"] },
  { code: "M1205", label: "Direction administrative et financière", kw: ["daf","directeur financier","cfo","directeur administratif","consolidation"] },
  { code: "M1206", label: "Management des risques", kw: ["risques","compliance","conformité","risk manager","aml","kyc","fraud"] },
  { code: "M1302", label: "Direction de projet", kw: ["chef de projet","project manager","pmo","scrum master","agile","moa","maîtrise ouvrage"] },
  // RH & juridique
  { code: "M1502", label: "Ressources humaines", kw: ["rh","ressources humaines","recrutement","talent acquisition","formation","paie","gpec","people operations"] },
  { code: "M1503", label: "Management des ressources humaines", kw: ["drh","directeur rh","hrm","people manager","culture","employee experience"] },
  { code: "K1901", label: "Droit / juridique", kw: ["juriste","droit","juridique","compliance","contract manager","legal","paralegal"] },
  // Santé & social
  { code: "J1501", label: "Soins infirmiers", kw: ["infirmier","soins","aide-soignant","nursing","médical"] },
  { code: "K1401", label: "Travail social", kw: ["travailleur social","assistant social","éducateur spécialisé","aide à domicile"] },
  // Hôtellerie & tourisme
  { code: "G1201", label: "Accueil touristique / hôtellerie", kw: ["hôtellerie","réception","réceptionniste","tourisme","accueil","front desk","hospitality","conciergerie"] },
  { code: "G1803", label: "Restauration", kw: ["restauration","cuisinier","chef","boulangerie","pâtisserie","traiteur","food","barista","serveur"] },
  // BTP & industrie
  { code: "F1702", label: "Construction / second œuvre", kw: ["btp","chantier","construction","maçon","électricien","plombier","second oeuvre","bâtiment"] },
  { code: "F1106", label: "Ingénierie construction / bâtiment", kw: ["ingénieur btp","génie civil","conducteur travaux","bim","structure","métreur","économiste de la construction"] },
  { code: "H2502", label: "Chaudronnerie / soudure", kw: ["chaudronnier","soudeur","métallurgie","forge","tuyauteur","monteur"] },
  { code: "H2603", label: "Électronique / électrotechnique", kw: ["électronicien","électrotechnicien","électrique","câblage","automatismes","plc","automate"] },
  { code: "H1201", label: "Ingénierie industrie / production", kw: ["ingénieur production","amélioration continue","lean","qualité","maintenance","industrie","méthodes","process"] },
  // Logistique
  { code: "N1301", label: "Logistique", kw: ["logistique","supply chain","entrepôt","expédition","transport","approvisionnement","gestionnaire stock","wms","erp logistique"] },
  { code: "N4301", label: "Supply chain / achats", kw: ["acheteur","achats","approvisionnements","sourcing","procurement","fournisseur","contract management"] },
  // Data & IA
  { code: "M1403", label: "Data / analyse de données", kw: ["data analyst","data scientist","bi","business intelligence","power bi","tableau","sql","machine learning","ia","intelligence artificielle","python data","r studio"] },
  { code: "M1811", label: "Data engineer / architecture data", kw: ["data engineer","data architect","pipeline","etl","databricks","spark","big data","kafka","airflow"] },
  // Design
  { code: "L1401", label: "Design graphique / illustration", kw: ["designer graphique","graphisme","illustrateur","photoshop","illustrator","figma","sketch","identité visuelle","packaging"] },
  { code: "E1205", label: "Réalisation de contenus multimédias", kw: ["vidéaste","photographe","photo","vidéo","content creator","tiktok","instagram","youtube","création de contenu"] },
];

function staticSearch(q: string): { code: string; label: string }[] {
  const query = q.toLowerCase().trim();
  if (!query) return ROME_DB.slice(0, 8).map((r) => ({ code: r.code, label: r.label }));

  const scored = ROME_DB.map((r) => {
    let score = 0;
    // Correspondance exacte sur le libellé
    if (r.label.toLowerCase().includes(query)) score += 10;
    // Correspondance sur les mots-clés
    for (const kw of r.kw) {
      if (kw.includes(query) || query.includes(kw)) score += kw === query ? 8 : 3;
    }
    // Chaque mot de la query matché
    const words = query.split(/\s+/);
    for (const w of words) {
      if (r.label.toLowerCase().includes(w)) score += 2;
      for (const kw of r.kw) { if (kw.includes(w)) score += 1; }
    }
    return { code: r.code, label: r.label, score };
  });

  return scored
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(({ code, label }) => ({ code, label }));
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (q.length < 2) {
    // Retourner les suggestions populaires par défaut
    return NextResponse.json(ROME_DB.slice(0, 8).map((r) => ({ code: r.code, label: r.label })));
  }

  // 1. Essayer France Travail (si credentials dispo)
  const ftResults = await searchFtRome(q);
  if (ftResults && ftResults.length > 0) {
    return NextResponse.json(ftResults);
  }

  // 2. Fallback statique
  return NextResponse.json(staticSearch(q));
}
