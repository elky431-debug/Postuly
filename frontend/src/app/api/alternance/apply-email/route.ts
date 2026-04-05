import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { chiffrer, dechiffrer } from "@/lib/crypto";
import { chargerCvPourPieceJointe } from "@/lib/cv-attachment";

export const runtime = "nodejs";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApplyEmailBody {
  companyName: string;
  siret?:      string;
  website?:    string;
  romeCode:    string;
  city?:       string;
  message?:    string;
}

// ─── Helpers email MIME ───────────────────────────────────────────────────────

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function textToHtml(text: string): string {
  return text.trim().split(/\n\s*\n/).filter(Boolean)
    .map((b) => `<p style="margin:0 0 1em 0;line-height:1.6;">${escapeHtml(b).replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

function plierBase64(b64: string) {
  return b64.match(/.{1,76}/g)?.join("\r\n") ?? b64;
}

function buildRaw(
  to: string, from: string, subject: string, html: string,
  pj?: { filename: string; content: Buffer; mimeType: string }
): string {
  const subjectB64 = Buffer.from(subject, "utf8").toString("base64");
  let raw: string;

  if (pj) {
    const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
    const htmlB64  = plierBase64(Buffer.from(html, "utf8").toString("base64"));
    const attB64   = plierBase64(pj.content.toString("base64"));
    const safeName = pj.filename.replace(/[^\x20-\x7E]/g, "_");
    raw = [
      `From: ${from}`, `To: ${to}`, `Subject: =?UTF-8?B?${subjectB64}?=`,
      "MIME-Version: 1.0", `Content-Type: multipart/mixed; boundary="${boundary}"`, "",
      `--${boundary}`,
      "Content-Type: text/html; charset=utf-8", "Content-Transfer-Encoding: base64", "", htmlB64,
      `--${boundary}`,
      `Content-Type: ${pj.mimeType}; name="${safeName}"`, "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${safeName}"`, "", attB64,
      `--${boundary}--`,
    ].join("\r\n");
  } else {
    raw = [
      `From: ${from}`, `To: ${to}`, `Subject: =?UTF-8?B?${subjectB64}?=`,
      "MIME-Version: 1.0", "Content-Type: text/html; charset=utf-8", "", html,
    ].join("\r\n");
  }

  return Buffer.from(raw).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// ─── Gmail token refresh ──────────────────────────────────────────────────────

async function refreshToken(refreshPlain: string): Promise<{ access_token: string; expires_in?: number }> {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshPlain,
      client_id:     process.env.GOOGLE_CLIENT_ID?.trim() ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "",
      grant_type:    "refresh_token",
    }),
  });
  const data = await r.json() as { access_token?: string; expires_in?: number; error?: string };
  if (!data.access_token) throw new Error(data.error ?? "refresh_token_invalid");
  return data as { access_token: string; expires_in?: number };
}

// ─── Recherche email via Hunter ───────────────────────────────────────────────

function simplifyName(name: string): string {
  return name.toLowerCase()
    .replace(/\b(sas|sarl|sa|sasu|eurl|snc|sci|scs|france|services|groupe|group|agency|agence|communication|conseil|media|médias)\b/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function extractDomain(url: string): string | null {
  try { return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, ""); }
  catch { return null; }
}

async function findEmailHunter(
  companyName: string,
  website?: string
): Promise<string | null> {
  const key = process.env.HUNTER_API_KEY?.trim();
  if (!key) return null;

  const domains: string[] = [];

  if (website) {
    const d = extractDomain(website);
    if (d) domains.push(d);
  }

  const simplified = simplifyName(companyName);
  if (simplified) {
    domains.push(`${simplified}.fr`, `${simplified}.com`);
  }

  for (const domain of domains) {
    try {
      const res = await fetch(
        `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${key}&limit=5`,
        { signal: AbortSignal.timeout(5_000) }
      );
      if (!res.ok) continue;
      const data = await res.json() as {
        data?: { emails?: Array<{ value: string; confidence: number; type?: string }> }
      };
      const emails = data.data?.emails ?? [];
      if (emails.length === 0) continue;

      // Priorité : emails RH/recrutement, sinon le plus confiant
      const hr = emails.find((e) =>
        /recrutement|rh|drh|hr|candidature|emploi|carriere|talent/i.test(e.value)
      );
      const best = hr ?? emails.sort((a, b) => b.confidence - a.confidence)[0];
      if (best?.value) return best.value;
    } catch {
      continue;
    }
  }

  return null;
}

// ─── Handler principal ────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Auth
  const token = req.headers.get("authorization")?.replace(/^Bearer /i, "");
  const user  = await getUserFromRequest(token);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  let body: ApplyEmailBody;
  try { body = await req.json() as ApplyEmailBody; }
  catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }

  const { companyName, siret, website, romeCode, city, message } = body;
  if (!companyName || !romeCode) {
    return NextResponse.json({ error: "companyName et romeCode sont requis" }, { status: 400 });
  }

  const admin = createAdminClient();

  // ── Vérifier doublon ────────────────────────────────────────────────────────
  if (siret) {
    const { data: existing } = await admin
      .from("lba_applications")
      .select("id")
      .eq("user_id", user.id)
      .eq("job_id", siret)
      .eq("job_type", "recruteur_lba")
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ error: "Tu as déjà postulé à cette entreprise." }, { status: 409 });
    }
  }

  // ── Profil ──────────────────────────────────────────────────────────────────
  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, cv_url, cv_parsed")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.cv_url) {
    return NextResponse.json(
      { error: "Aucun CV trouvé. Uploade d'abord ton CV dans la section « Mon CV »." },
      { status: 422 }
    );
  }

  // ── Gmail tokens ─────────────────────────────────────────────────────────────
  const { data: tokenData } = await admin
    .from("gmail_tokens")
    .select("access_token, refresh_token, token_expiry, gmail_email")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!tokenData?.gmail_email) {
    return NextResponse.json(
      { error: "Gmail non connecté. Connecte ton Gmail dans les Paramètres pour pouvoir postuler." },
      { status: 422 }
    );
  }

  // ── Chercher email de l'entreprise ──────────────────────────────────────────
  const companyEmail = await findEmailHunter(companyName, website);
  if (!companyEmail) {
    return NextResponse.json(
      { error: `Aucun email trouvé pour "${companyName}". Essaie de les contacter via leur site web.` },
      { status: 404 }
    );
  }

  // ── Charger CV ──────────────────────────────────────────────────────────────
  const pj = await chargerCvPourPieceJointe(admin, profile.cv_url as string);
  if (!pj) {
    return NextResponse.json({ error: "Impossible de charger le CV. Ré-uploade-le dans Mon CV." }, { status: 503 });
  }

  // ── Préparer expéditeur ─────────────────────────────────────────────────────
  let accessToken: string;
  let refreshPlain: string;
  try {
    accessToken  = dechiffrer(tokenData.access_token);
    refreshPlain = dechiffrer(tokenData.refresh_token);
  } catch {
    return NextResponse.json({ error: "Tokens Gmail illisibles" }, { status: 500 });
  }

  const expiry = tokenData.token_expiry ? new Date(tokenData.token_expiry) : null;
  if (!expiry || expiry.getTime() <= Date.now() + 60_000) {
    try {
      const refreshed = await refreshToken(refreshPlain);
      accessToken = refreshed.access_token;
      const ms = (refreshed.expires_in ?? 3600) * 1000;
      await admin.from("gmail_tokens").update({
        access_token: chiffrer(accessToken),
        token_expiry: new Date(Date.now() + ms).toISOString(),
      }).eq("user_id", user.id);
    } catch {
      return NextResponse.json({ error: "Impossible de rafraîchir le token Gmail" }, { status: 401 });
    }
  }

  // ── Construire et envoyer l'email ───────────────────────────────────────────
  const parsed    = (profile.cv_parsed ?? null) as { email?: string } | null;
  const fromEmail = tokenData.gmail_email as string;
  const fullName  = ((profile.full_name as string | null) ?? "").trim() || (user.email ?? "Candidat");
  const subject   = `Candidature spontanée en alternance — ${companyName}`;
  const html      = textToHtml(message?.trim() || `Madame, Monsieur,\n\nJe vous adresse ma candidature spontanée en alternance.\n\nCordialement,\n${fullName}`);

  const raw = buildRaw(companyEmail, fromEmail, subject, html, pj);

  const gmailRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
  });

  if (!gmailRes.ok) {
    const errText = await gmailRes.text().catch(() => "");
    return NextResponse.json({ error: `Échec Gmail : ${errText.slice(0, 200)}` }, { status: 502 });
  }

  // ── Log en base ─────────────────────────────────────────────────────────────
  await admin.from("lba_applications").insert({
    user_id:      user.id,
    job_id:       siret ?? companyName,
    job_type:     "recruteur_lba",
    siret:        siret ?? null,
    company_name: companyName,
    rome_code:    romeCode,
    city:         city ?? null,
    status:       "envoyee",
  });

  return NextResponse.json({ ok: true, sentTo: companyEmail, message: `Candidature envoyée à ${companyName}` });
}
