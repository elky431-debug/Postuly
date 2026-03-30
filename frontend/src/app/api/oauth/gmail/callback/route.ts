import { NextRequest, NextResponse } from "next/server";
import { chiffrer } from "@/lib/crypto";
import { verifierStateOAuth } from "@/lib/gmail-oauth-state";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Callback OAuth Google : échange le code, enregistre les tokens chiffrés (service role).
 */
export async function GET(req: NextRequest) {
  const baseRedirect = "/dashboard/parametres";

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError === "access_denied" || !code) {
    return NextResponse.redirect(
      new URL(`${baseRedirect}?error=oauth_cancelled`, req.nextUrl.origin)
    );
  }

  const verified = verifierStateOAuth(state);
  if (!verified) {
    return NextResponse.redirect(new URL(`${baseRedirect}?error=invalid_state`, req.nextUrl.origin));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.redirect(new URL(`${baseRedirect}?error=config`, req.nextUrl.origin));
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const tokens = (await tokenRes.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
  };

  if (!tokens.access_token) {
    return NextResponse.redirect(new URL(`${baseRedirect}?error=token_failed`, req.nextUrl.origin));
  }

  const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const userInfo = (await userInfoRes.json()) as { email?: string };

  let refreshEnc: string;
  if (tokens.refresh_token) {
    refreshEnc = chiffrer(tokens.refresh_token);
  } else {
    const admin = createAdminClient();
    const { data: existing } = await admin
      .from("gmail_tokens")
      .select("refresh_token")
      .eq("user_id", verified.userId)
      .maybeSingle();
    if (existing?.refresh_token) {
      refreshEnc = existing.refresh_token;
    } else {
      return NextResponse.redirect(
        new URL(`${baseRedirect}?error=no_refresh_token`, req.nextUrl.origin)
      );
    }
  }

  const accessEnc = chiffrer(tokens.access_token);
  const expiryMs = (tokens.expires_in ?? 3600) * 1000;
  const tokenExpiry = new Date(Date.now() + expiryMs).toISOString();

  const admin = createAdminClient();
  const { error: upsertErr } = await admin.from("gmail_tokens").upsert(
    {
      user_id: verified.userId,
      access_token: accessEnc,
      refresh_token: refreshEnc,
      token_expiry: tokenExpiry,
      gmail_email: userInfo.email ?? null,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (upsertErr) {
    return NextResponse.redirect(new URL(`${baseRedirect}?error=db_failed`, req.nextUrl.origin));
  }

  return NextResponse.redirect(new URL(`${baseRedirect}?success=gmail_connected`, req.nextUrl.origin));
}
