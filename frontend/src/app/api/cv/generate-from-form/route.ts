/**
 * POST /api/cv/generate-from-form — enrichit le formulaire « Créer mon CV » via OpenAI.
 */
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/supabase/server";
import { resolveOpenAiApiKey } from "@/lib/openai-env";
import type { CreateCvFormData, EnrichedCvJson } from "@/types/create-cv";

export const runtime = "nodejs";

const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

function buildUserPrompt(formData: CreateCvFormData): string {
  // La photo est en base64 : on ne l’envoie pas au modèle (poids + inutile pour le texte).
  const { photo_base64: _omit, ...sansPhoto } = formData;
  void _omit;
  const payload = JSON.stringify(sansPhoto);
  return `Tu es un expert en rédaction de CV professionnel.
Génère un CV professionnel en français pour la personne ci-dessous.
Améliore les descriptions, rends les bullet points percutants,
enrichis l'accroche.
Aucun « poste recherché » n'est fourni : pour le champ titre, propose un intitulé professionnel court cohérent avec les expériences (ex. dernière fonction ou domaine), ou une chaîne vide si impossible à déduire.
Pour chaque periode (expériences et formations), utilise des dates en français en toutes lettres, par ex. « janvier 2023 – mars 2025 » ou « 15 septembre 2024 – en cours », jamais uniquement des formats numériques type 03/2026.

Réponds par UN SEUL objet JSON (pas de markdown, pas de texte avant ou après) avec exactement cette structure :
{
  "prenom": "",
  "nom": "",
  "titre": "",
  "email": "",
  "tel": "",
  "ville": "",
  "linkedin": "",
  "accroche": "",
  "experiences": [{"titre":"","entreprise":"","periode":"","lieu":"","points":[]}],
  "formations": [{"diplome":"","ecole":"","periode":"","lieu":"","detail":""}],
  "skills": [],
  "langues": [{"langue":"","niveau":""}],
  "loisirs": ""
}

Données source (à transformer et enrichir) : ${payload}`;
}

/** Messages utilisateur pour erreurs API OpenAI. */
function messageFromOpenAiErrorBody(status: number, errText: string): string {
  try {
    const j = JSON.parse(errText) as {
      error?: { message?: string; code?: string; type?: string };
    };
    const msg = (j.error?.message ?? "").trim();
    const code = (j.error?.code ?? "").toLowerCase();
    const low = msg.toLowerCase();
    if (
      code === "insufficient_quota" ||
      low.includes("quota") ||
      low.includes("billing") ||
      low.includes("exceeded your current quota")
    ) {
      return (
        "Quota ou crédits OpenAI insuffisants. Vérifie ton compte sur platform.openai.com " +
        "(Billing), puis réessaie. Tu peux aussi mettre une autre clé dans OPENAI_API_KEY (.env.local)."
      );
    }
    if (low.includes("invalid api key") || code === "invalid_api_key") {
      return "Clé API OpenAI invalide. Vérifie OPENAI_API_KEY dans .env.local.";
    }
    if (msg) {
      return `L’IA n’a pas pu générer le CV (${status}) : ${msg}`;
    }
  } catch {
    /* corps non JSON */
  }
  return `Erreur du service IA OpenAI (HTTP ${status}). Réessaie plus tard ou vérifie ta configuration.`;
}

function extractJsonFromAssistantText(text: string): EnrichedCvJson {
  let t = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/m;
  const m = t.match(fence);
  if (m) t = m[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Réponse IA : JSON introuvable.");
  }
  t = t.slice(start, end + 1);
  const parsed = JSON.parse(t) as EnrichedCvJson;
  return parsed;
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer /i, "");
  const user = await getUserFromRequest(token);
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let body: { formData?: CreateCvFormData };
  try {
    body = (await req.json()) as { formData?: CreateCvFormData };
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 });
  }

  const formData = body.formData;
  if (!formData || typeof formData !== "object") {
    return NextResponse.json({ error: "formData requis" }, { status: 400 });
  }

  const openaiKey = resolveOpenAiApiKey();
  if (!openaiKey) {
    return NextResponse.json(
      {
        error:
          "OPENAI_API_KEY introuvable. Ajoute-la dans frontend/.env.local (recommandé) ou dans backend/.env en local — " +
          "les routes Next ne lisent pas automatiquement backend/.env. Clé : platform.openai.com",
      },
      { status: 503 }
    );
  }

  const model = process.env.OPENAI_CV_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
  const userPrompt = buildUserPrompt(formData);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 8192,
        temperature: 0.45,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Tu réponds uniquement avec un objet JSON valide en français, sans texte hors JSON. " +
              "Le JSON doit décrire un CV enrichi selon les instructions utilisateur.",
          },
          { role: "user", content: userPrompt },
        ],
      }),
      signal: AbortSignal.timeout(120_000),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json(
        { error: messageFromOpenAiErrorBody(res.status, errText) },
        { status: 502 }
      );
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content ?? "";
    if (!text) {
      return NextResponse.json(
        { error: "Réponse vide du modèle OpenAI." },
        { status: 502 }
      );
    }

    const enriched = extractJsonFromAssistantText(text);
    return NextResponse.json({ enriched });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur inconnue";
    return NextResponse.json(
      { error: "Échec génération CV", detail: msg },
      { status: 500 }
    );
  }
}
