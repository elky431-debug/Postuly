/**
 * POST /api/alternance/generate-letter
 * Génère une lettre de motivation courte pour une candidature spontanée en alternance.
 * Utilise Anthropic en priorité, fallback OpenAI, via fetch direct (pas de SDK frontend).
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
  fullName: string;
  skills: string;
  experiences: string;
  companyName: string;
  nafText?: string;
  address?: string;
  romeLabel?: string;
}): string {
  return `Tu es un expert en recrutement français. Rédige une lettre de motivation courte et professionnelle pour une candidature spontanée en alternance.

## Candidat
- Nom : ${p.fullName}
- Compétences : ${p.skills || "non spécifiées"}
- Expériences : ${p.experiences || "non spécifiées"}

## Entreprise
- Nom : ${p.companyName}
- Secteur : ${p.nafText || p.romeLabel || "non spécifié"}
- Ville : ${p.address || "non spécifiée"}

## Format obligatoire (texte brut, rendu e-mail)
- Première ligne exactement : Monsieur, Madame,
- Ligne vide, puis 3 paragraphes séparés par une ligne vide
- Après le 3e paragraphe : ligne vide, puis Cordialement,
- Max 200 mots, vouvoiement, ton dynamique alternance
- PAS de HTML, markdown, ni numérotation
- Retourne UNIQUEMENT la lettre, sans commentaire`;
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

  const fullName    = (profile?.full_name ?? "").trim() || "Candidat";
  const cvParsed    = (profile?.cv_parsed ?? {}) as Record<string, unknown>;
  const skills      = Array.isArray(cvParsed.skills)
    ? (cvParsed.skills as string[]).slice(0, 8).join(", ")
    : "";
  const experiences = Array.isArray(cvParsed.experiences)
    ? (cvParsed.experiences as string[]).slice(0, 3).join(" / ")
    : "";

  const prompt = buildPrompt({ fullName, skills, experiences, ...body });

  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
  const openaiKey    = process.env.OPENAI_API_KEY?.trim();

  try {
    if (anthropicKey) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key":         anthropicKey,
          "anthropic-version": "2023-06-01",
          "Content-Type":      "application/json",
        },
        body: JSON.stringify({
          model:      "claude-haiku-4-5-20251001",
          max_tokens: 600,
          messages:   [{ role: "user", content: prompt }],
        }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new Error(`Anthropic ${res.status}`);
      const data = await res.json() as { content: Array<{ text: string }> };
      return NextResponse.json({ letter: data.content[0]?.text ?? "" });
    }

    if (openaiKey) {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization:  `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model:       "gpt-4o-mini",
          max_tokens:  600,
          temperature: 0.7,
          messages: [
            { role: "system", content: "Tu es un expert en rédaction de lettres de motivation en français." },
            { role: "user",   content: prompt },
          ],
        }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new Error(`OpenAI ${res.status}`);
      const data = await res.json() as { choices: Array<{ message: { content: string } }> };
      return NextResponse.json({ letter: data.choices[0]?.message.content ?? "" });
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur génération IA" },
      { status: 502 }
    );
  }

  return NextResponse.json(
    { error: "Aucune clé IA configurée (ANTHROPIC_API_KEY ou OPENAI_API_KEY)" },
    { status: 503 }
  );
}
