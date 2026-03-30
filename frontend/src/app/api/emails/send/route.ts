import { NextRequest, NextResponse } from "next/server";
import { chiffrer, dechiffrer } from "@/lib/crypto";
import { verifierCleInterne } from "@/lib/internal-api";
import { createAdminClient } from "@/lib/supabase/admin";

/** Encode le message au format attendu par Gmail API (raw base64url). */
function encoderEmail(to: string, from: string, subject: string, body: string): string {
  const subjectB64 = Buffer.from(subject, "utf8").toString("base64");
  const email = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${subjectB64}?=`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=utf-8`,
    ``,
    body,
  ].join("\r\n");
  return Buffer.from(email)
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

  const { to, subject, body: htmlBody, userId } = body;
  if (!to?.trim() || !subject?.trim() || !htmlBody?.trim() || !userId?.trim()) {
    return NextResponse.json(
      { error: "Champs requis : to, subject, body, userId" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
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

  const raw = encoderEmail(to.trim(), tokenData.gmail_email, subject.trim(), htmlBody);

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
  return NextResponse.json({ success: true, messageId: result.id ?? null });
}
