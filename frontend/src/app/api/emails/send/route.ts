import { NextRequest, NextResponse } from "next/server";
import { chiffrer, dechiffrer } from "@/lib/crypto";
import { verifierCleInterne } from "@/lib/internal-api";
import { chargerCvPourPieceJointe } from "@/lib/cv-attachment";
import { createAdminClient } from "@/lib/supabase/admin";

/** Échappe le texte pour insertion dans du HTML. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Détecte un corps déjà balisé (édition manuelle ou pipeline HTML). */
function ressembleHtmlBrut(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return /<\/p\s*>|<br\s*\/?\s*>|<div\b|<span\b|<html\b/i.test(t);
}

/**
 * Convertit une lettre en texte brut en HTML à paragraphes (comme l’aperçu produit).
 */
function lettreTexteVersHtml(texte: string): string {
  const trimmed = texte.trim();
  if (!trimmed) return "";
  if (ressembleHtmlBrut(trimmed)) {
    return trimmed;
  }
  const blocs = texte
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  if (blocs.length === 0) {
    return `<p style="margin:0 0 1em 0;line-height:1.6;">${escapeHtml(texte)}</p>`;
  }
  return blocs
    .map(
      (bloc) =>
        `<p style="margin:0 0 1em 0;line-height:1.6;">${escapeHtml(bloc).replace(/\n/g, "<br>")}</p>`
    )
    .join("\n");
}

/** Encode le message au format attendu par Gmail API (raw base64url), corps HTML simple. */
function encoderEmail(to: string, from: string, subject: string, corpsHtml: string): string {
  const subjectB64 = Buffer.from(subject, "utf8").toString("base64");
  const email = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${subjectB64}?=`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=utf-8`,
    ``,
    corpsHtml,
  ].join("\r\n");
  return Buffer.from(email)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Plie du base64 sur 76 caractères par ligne (RFC). */
function plierBase64(b64: string): string {
  return b64.match(/.{1,76}/g)?.join("\r\n") ?? b64;
}

/**
 * MIME multipart/mixed : HTML + pièce jointe optionnelle (Gmail raw).
 */
function encoderEmailMultipart(
  to: string,
  from: string,
  subject: string,
  corpsHtml: string,
  pj: { filename: string; content: Buffer; mimeType: string }
): string {
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
  const subjectB64 = Buffer.from(subject, "utf8").toString("base64");
  const htmlB64 = plierBase64(Buffer.from(corpsHtml, "utf8").toString("base64"));
  const attB64 = plierBase64(pj.content.toString("base64"));
  const safeName = pj.filename.replace(/[^\x20-\x7E]/g, "_");

  const raw = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${subjectB64}?=`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    htmlB64,
    `--${boundary}`,
    `Content-Type: ${pj.mimeType}; name="${safeName}"`,
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename="${safeName}"`,
    "",
    attB64,
    `--${boundary}--`,
  ].join("\r\n");

  return Buffer.from(raw)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function rafraichirTokenAccess(refreshTokenPlain: string): Promise<{
  access_token: string;
  expires_in?: number;
}> {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth non configuré");
  }
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshTokenPlain,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  const data = (await r.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!data.access_token) {
    throw new Error(data.error ?? "refresh_token_invalid");
  }
  return { access_token: data.access_token, expires_in: data.expires_in };
}

/**
 * Envoie un e-mail via Gmail API avec le compte de l’utilisateur.
 * Appel serveur à serveur (n8n) : header x-internal-key obligatoire.
 */
export async function POST(req: NextRequest) {
  if (!verifierCleInterne(req)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  let body: {
    to?: string;
    subject?: string;
    body?: string;
    userId?: string;
    applicationId?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const { to, subject, body: corpsBrut, userId } = body;
  if (!to?.trim() || !subject?.trim() || !corpsBrut?.trim() || !userId?.trim()) {
    return NextResponse.json(
      { error: "Champs requis : to, subject, body, userId" },
      { status: 400 }
    );
  }

  const corpsHtml = lettreTexteVersHtml(corpsBrut);

  const admin = createAdminClient();
  const { data: profilCv } = await admin
    .from("profiles")
    .select("cv_url")
    .eq("id", userId)
    .maybeSingle();

  let pieceJointe: Awaited<ReturnType<typeof chargerCvPourPieceJointe>> | undefined;
  if (profilCv?.cv_url?.trim()) {
    pieceJointe = await chargerCvPourPieceJointe(admin, profilCv.cv_url);
    if (!pieceJointe) {
      return NextResponse.json(
        {
          error:
            "Impossible de récupérer le CV pour la pièce jointe (cv_url invalide, bucket « cvs » ou droits Storage).",
        },
        { status: 503 }
      );
    }
  }

  const { data: tokenData, error: fetchErr } = await admin
    .from("gmail_tokens")
    .select("access_token, refresh_token, token_expiry, gmail_email")
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchErr || !tokenData?.gmail_email) {
    return NextResponse.json({ error: "Gmail non connecté pour cet utilisateur" }, { status: 404 });
  }

  let accessToken: string;
  try {
    accessToken = dechiffrer(tokenData.access_token);
  } catch {
    return NextResponse.json({ error: "Token stocké illisible" }, { status: 500 });
  }

  let refreshPlain: string;
  try {
    refreshPlain = dechiffrer(tokenData.refresh_token);
  } catch {
    return NextResponse.json({ error: "Refresh token illisible" }, { status: 500 });
  }

  const expiry = tokenData.token_expiry ? new Date(tokenData.token_expiry) : null;
  if (!expiry || expiry.getTime() <= Date.now() + 60_000) {
    try {
      const refreshed = await rafraichirTokenAccess(refreshPlain);
      accessToken = refreshed.access_token;
      const ms = (refreshed.expires_in ?? 3600) * 1000;
      await admin
        .from("gmail_tokens")
        .update({
          access_token: chiffrer(accessToken),
          token_expiry: new Date(Date.now() + ms).toISOString(),
        })
        .eq("user_id", userId);
    } catch {
      return NextResponse.json({ error: "Impossible de rafraîchir le token Gmail" }, { status: 401 });
    }
  }

  const raw = pieceJointe
    ? encoderEmailMultipart(to.trim(), tokenData.gmail_email, subject.trim(), corpsHtml, pieceJointe)
    : encoderEmail(to.trim(), tokenData.gmail_email, subject.trim(), corpsHtml);

  const gmailRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });

  if (!gmailRes.ok) {
    const errText = await gmailRes.text();
    return NextResponse.json(
      { error: "Échec Gmail API", detail: errText.slice(0, 500) },
      { status: 502 }
    );
  }

  const result = (await gmailRes.json()) as { id?: string };
  return NextResponse.json({
    success: true,
    messageId: result.id ?? null,
    attachmentIncluded: Boolean(pieceJointe),
  });
}
