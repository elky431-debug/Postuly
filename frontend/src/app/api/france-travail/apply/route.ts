/**
 * POST /api/france-travail/apply
 * Envoie une candidature directement par Gmail (avec CV en PJ) pour une offre France Travail.
 * Auth : JWT utilisateur (Authorization: Bearer <token>)
 */
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { chiffrer, dechiffrer } from "@/lib/crypto";
import { chargerCvPourPieceJointe } from "@/lib/cv-attachment";

export const runtime = "nodejs";

// ─── Helpers copiés de /api/emails/send ──────────────────────────────────────

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function lettreVersHtml(texte: string): string {
  const blocs = texte.trim().split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  return blocs.map((b) => `<p style="margin:0 0 1em 0;line-height:1.6;">${escapeHtml(b).replace(/\n/g, "<br>")}</p>`).join("\n");
}

function plierBase64(b64: string) {
  return b64.match(/.{1,76}/g)?.join("\r\n") ?? b64;
}

function encoderEmail(to: string, from: string, subject: string, html: string): string {
  const subjB64 = Buffer.from(subject, "utf8").toString("base64");
  const raw = [`From: ${from}`, `To: ${to}`, `Subject: =?UTF-8?B?${subjB64}?=`, "MIME-Version: 1.0", "Content-Type: text/html; charset=utf-8", "", html].join("\r\n");
  return Buffer.from(raw).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function encoderEmailMultipart(
  to: string, from: string, subject: string, html: string,
  pj: { filename: string; content: Buffer; mimeType: string }
): string {
  const boundary = `----=_Part_${Date.now()}`;
  const subjB64 = Buffer.from(subject, "utf8").toString("base64");
  const htmlB64 = plierBase64(Buffer.from(html, "utf8").toString("base64"));
  const attB64 = plierBase64(pj.content.toString("base64"));
  const raw = [
    `From: ${from}`, `To: ${to}`, `Subject: =?UTF-8?B?${subjB64}?=`,
    "MIME-Version: 1.0", `Content-Type: multipart/mixed; boundary="${boundary}"`, "",
    `--${boundary}`, "Content-Type: text/html; charset=utf-8", "Content-Transfer-Encoding: base64", "", htmlB64,
    `--${boundary}`, `Content-Type: ${pj.mimeType}; name="${pj.filename}"`,
    "Content-Transfer-Encoding: base64", `Content-Disposition: attachment; filename="${pj.filename}"`, "", attB64,
    `--${boundary}--`,
  ].join("\r\n");
  return Buffer.from(raw).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function refreshToken(refreshPlain: string): Promise<string> {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshPlain,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      grant_type: "refresh_token",
    }),
  });
  const data = (await r.json()) as { access_token?: string; error?: string };
  if (!data.access_token) throw new Error(data.error ?? "refresh_failed");
  return data.access_token;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer /i, "");
  const user = await getUserFromRequest(token);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = (await req.json()) as {
    to: string;
    subject: string;
    letter: string;
  };

  if (!body.to?.trim() || !body.subject?.trim() || !body.letter?.trim()) {
    return NextResponse.json({ error: "Champs requis : to, subject, letter" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Gmail token
  const { data: tokenData } = await admin
    .from("gmail_tokens")
    .select("access_token, refresh_token, token_expiry, gmail_email")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!tokenData?.gmail_email) {
    return NextResponse.json({
      error: "Gmail non connecté. Connecte ton compte Gmail dans Paramètres pour postuler directement.",
      gmailRequired: true,
    }, { status: 404 });
  }

  let accessToken = dechiffrer(tokenData.access_token);
  const expiry = tokenData.token_expiry ? new Date(tokenData.token_expiry) : null;

  if (!expiry || expiry.getTime() <= Date.now() + 60_000) {
    try {
      accessToken = await refreshToken(dechiffrer(tokenData.refresh_token));
      await admin.from("gmail_tokens").update({
        access_token: chiffrer(accessToken),
        token_expiry: new Date(Date.now() + 3600_000).toISOString(),
      }).eq("user_id", user.id);
    } catch {
      return NextResponse.json({ error: "Token Gmail expiré, reconnecte Gmail dans Paramètres." }, { status: 401 });
    }
  }

  // CV en pièce jointe
  const { data: profile } = await admin.from("profiles").select("cv_url").eq("id", user.id).maybeSingle();
  const pj = profile?.cv_url ? await chargerCvPourPieceJointe(admin, profile.cv_url) : null;

  const html = lettreVersHtml(body.letter);
  const raw = pj
    ? encoderEmailMultipart(body.to.trim(), tokenData.gmail_email, body.subject.trim(), html, pj)
    : encoderEmail(body.to.trim(), tokenData.gmail_email, body.subject.trim(), html);

  const gmailRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
  });

  if (!gmailRes.ok) {
    const err = await gmailRes.text().catch(() => "");
    return NextResponse.json({ error: `Échec envoi Gmail: ${err.slice(0, 200)}` }, { status: 502 });
  }

  const result = (await gmailRes.json()) as { id?: string };
  return NextResponse.json({ success: true, messageId: result.id, withCv: !!pj });
}
