import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, createSupabaseFromBearer } from "@/lib/supabase/server";

/**
 * Relance toutes les candidatures « sent » pour plusieurs campagnes (sélection sur la liste Relance).
 */
export async function POST(req: NextRequest) {
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

  let campaignIds: string[] = [];
  try {
    const b = await req.json();
    if (Array.isArray(b.campaignIds)) {
      campaignIds = [...new Set(b.campaignIds.filter((x: unknown) => typeof x === "string"))];
    }
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  if (campaignIds.length === 0) {
    return NextResponse.json({ error: "campaignIds requis (tableau non vide)" }, { status: 400 });
  }

  const { data: camps, error: cErr } = await client
    .from("campaigns")
    .select("id")
    .in("id", campaignIds)
    .eq("user_id", user.id);

  if (cErr) {
    return NextResponse.json({ detail: cErr.message }, { status: 400 });
  }

  const owned = new Set((camps ?? []).map((c) => c.id as string));
  if (owned.size !== campaignIds.length) {
    return NextResponse.json(
      { error: "Une ou plusieurs campagnes sont introuvables ou ne t’appartiennent pas." },
      { status: 403 }
    );
  }

  const { data: rows, error: aErr } = await client
    .from("applications")
    .select("id")
    .in("campaign_id", campaignIds)
    .eq("status", "sent");

  if (aErr) {
    return NextResponse.json({ detail: aErr.message }, { status: 400 });
  }

  const applicationIds = (rows ?? []).map((r) => r.id as string);
  if (applicationIds.length === 0) {
    return NextResponse.json(
      { error: "Aucune candidature « Envoyé » à relancer dans la sélection." },
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
    body: JSON.stringify({ applicationIds }),
  });

  const text = await relanceRes.text();
  return new NextResponse(text, {
    status: relanceRes.status,
    headers: { "Content-Type": relanceRes.headers.get("content-type") || "application/json" },
  });
}
