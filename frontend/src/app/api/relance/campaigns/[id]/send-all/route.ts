import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, createSupabaseFromBearer } from "@/lib/supabase/server";

/**
 * Relance en masse : toutes les candidatures « sent » de la campagne.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: campaignId } = await ctx.params;
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

  const { data: camp, error: cErr } = await client
    .from("campaigns")
    .select("id")
    .eq("id", campaignId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (cErr || !camp) {
    return NextResponse.json({ error: "Campagne introuvable" }, { status: 404 });
  }

  const { data: rows, error: aErr } = await client
    .from("applications")
    .select("id")
    .eq("campaign_id", campaignId)
    .eq("status", "sent");

  if (aErr) {
    return NextResponse.json({ detail: aErr.message }, { status: 400 });
  }

  const applicationIds = (rows ?? []).map((r) => r.id as string);
  if (applicationIds.length === 0) {
    return NextResponse.json(
      { error: "Aucune candidature « Envoyé » à relancer dans cette campagne." },
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
