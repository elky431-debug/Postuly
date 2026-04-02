import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, createSupabaseFromBearer } from "@/lib/supabase/server";

/**
 * Envoie une relance pour une seule candidature (statut « sent »).
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
  const user = await getUserFromRequest(token);
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const client = createSupabaseFromBearer(token);
  if (!client) {
    return NextResponse.json({ error: "Configuration Supabase invalide" }, { status: 503 });
  }

  const { data: app, error } = await client
    .from("applications")
    .select("id, status, campaign_id")
    .eq("id", id)
    .maybeSingle();

  if (error || !app) {
    return NextResponse.json({ error: "Candidature introuvable" }, { status: 404 });
  }

  const { data: camp } = await client
    .from("campaigns")
    .select("user_id")
    .eq("id", app.campaign_id as string)
    .maybeSingle();

  if (!camp || camp.user_id !== user.id) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  if (app.status !== "sent") {
    return NextResponse.json(
      { error: "Seules les candidatures « Envoyé » peuvent être relancées." },
      { status: 400 }
    );
  }

  const origin = req.nextUrl.origin;
  const relanceRes = await fetch(`${origin}/api/n8n/relance-applications`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ applicationIds: [id] }),
  });

  const text = await relanceRes.text();
  return new NextResponse(text, {
    status: relanceRes.status,
    headers: { "Content-Type": relanceRes.headers.get("content-type") || "application/json" },
  });
}
