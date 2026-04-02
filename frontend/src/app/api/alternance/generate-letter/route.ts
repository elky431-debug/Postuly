/**
 * POST /api/alternance/generate-letter
 * Génère une lettre de motivation pour une candidature spontanée en alternance.
 * Utilise OpenAI (gpt-4o-mini).
 */
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

interface Body {
  companyName: string;
  nafText?:    string;
  address?:    string;
  romeLabel?:  string;
}

function buildPrompt(p: {
  firstName:   string;
  lastName:    string;
  email:       string;
  skills:      string;
  experiences: string;
  formations:  string;
  languages:   string;
  companyName: string;
  nafText?:    string;
  address?:    string;
  romeLabel?:  string;
}): string {
  const sector = p.nafText || p.romeLabel || "non spécifié";
  const city   = p.address || "non spécifiée";

  return `Tu es un expert en recrutement français. Tu rédiges des lettres de motivation percutantes, naturelles et personnalisées.

Profil du candidat
Nom : ${p.firstName} ${p.lastName}
Email : ${p.email}
Expériences :
${p.experiences || "non spécifiées"}
Formations :
${p.formations || "non spécifiées"}
Compétences : ${p.skills || "non spécifiées"}
Langues : ${p.languages || "non spécifiées"}

Candidature
Entreprise : ${p.companyName}
Secteur : ${sector}
Poste visé : alternant(e)
Type de contrat : alternance
Ville : ${city}

Ton attendu selon le contrat
stage : enthousiaste et motivé, style étudiant sérieux, focus sur l'apprentissage
alternance : dynamique et concret, met en avant le rythme école/entreprise et les compétences en développement
CDI : professionnel et confiant, focus sur la valeur ajoutée immédiate et la projection long terme
CDD : réactif et opérationnel, disponibilité et adaptabilité mises en avant

Instructions
Adopte le ton correspondant au type de contrat ci-dessus
Structure : accroche (1 phrase marquante) → pourquoi cette entreprise → ce que le candidat apporte → conclusion + appel à action
Longueur : 3 paragraphes, max 250 mots
Langue : français, vouvoiement
NE PAS inventer de détails absents du profil
NE PAS utiliser de formules bateau ("Je me permets de vous adresser ma candidature...")
Terminer par une formule de politesse sobre
Retourner UNIQUEMENT la lettre, sans commentaire ni balise

Rédige maintenant la lettre de motivation.`;
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer /i, "");
  const user  = await getUserFromRequest(token);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  let body: Body;
  try { body = (await req.json()) as Body; }
  catch { return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 }); }

  if (!body.companyName) {
    return NextResponse.json({ error: "companyName requis" }, { status: 400 });
  }

  // ── Profil utilisateur ────────────────────────────────────────────────────
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, cv_parsed")
    .eq("id", user.id)
    .single();

  const fullName   = (profile?.full_name ?? "").trim() || "Candidat";
  const nameParts  = fullName.split(/\s+/);
  const firstName  = nameParts[0] ?? "Candidat";
  const lastName   = nameParts.slice(1).join(" ") || "";
  const cvParsed   = (profile?.cv_parsed ?? {}) as Record<string, unknown>;

  const skills      = Array.isArray(cvParsed.skills)
    ? (cvParsed.skills as string[]).slice(0, 12).join(", ")
    : "";
  const experiences = Array.isArray(cvParsed.experiences)
    ? (cvParsed.experiences as string[]).slice(0, 6).join("\n")
    : "";
  const formations  = Array.isArray(cvParsed.education)
    ? (cvParsed.education as string[]).slice(0, 6).join("\n")
    : "";
  const languages   = Array.isArray(cvParsed.languages)
    ? (cvParsed.languages as string[]).slice(0, 8).join(", ")
    : "";
  const email       = (cvParsed.email as string | undefined) || user.email || "";

  const prompt = buildPrompt({ firstName, lastName, email, skills, experiences, formations, languages, ...body });

  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  if (!openaiKey) {
    return NextResponse.json(
      { error: "Clé OPENAI_API_KEY manquante dans les variables d'environnement." },
      { status: 503 }
    );
  }

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization:  `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model:       "gpt-4o-mini",
        max_tokens:  700,
        temperature: 0.7,
        messages: [
          {
            role:    "system",
            content: "Tu es un expert en rédaction de lettres de motivation en français. Tu retournes uniquement la lettre, sans commentaire.",
          },
          { role: "user", content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(25_000),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`OpenAI ${res.status}: ${txt.slice(0, 200)}`);
    }

    const data = await res.json() as { choices: Array<{ message: { content: string } }> };
    return NextResponse.json({ letter: data.choices[0]?.message.content ?? "" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur génération IA" },
      { status: 502 }
    );
  }
}
