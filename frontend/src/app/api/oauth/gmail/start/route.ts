import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/supabase/server";
import { signerStateOAuth } from "@/lib/gmail-oauth-state";

/**
 * Démarre le flux OAuth Google (réponse JSON + redirection côté client).
 * POST + Authorization: Bearer <session Supabase>.
 */
export async function POST(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (!clientId || !redirectUri) {
    return NextResponse.json(
      {
        error:
          "GOOGLE_CLIENT_ID ou GOOGLE_REDIRECT_URI manquant (Netlify → Environment variables ou .env.local). " +
          "En prod, GOOGLE_REDIRECT_URI doit être https://TON_DOMAINE/api/oauth/gmail/callback (même URI dans Google Cloud).",
      },
      { status: 503 }
    );
  }

  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
  const user = await getUserFromRequest(token);
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let state: string;
  try {
    state = signerStateOAuth(user.id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "State invalide";
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: [
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/userinfo.email",
    ].join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  });

  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  return NextResponse.json({ url });
}
