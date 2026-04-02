import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, createSupabaseFromBearer } from "@/lib/supabase/server";

/**
 * Détail campagne + candidatures (jointures entreprise / contact).
 */
export async function GET(
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

  const { data: camp, error: cErr } = await client
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (cErr || !camp) {
    return NextResponse.json({ error: "Campagne introuvable" }, { status: 404 });
  }

  const { data: apps, error: aErr } = await client
    .from("applications")
    .select("*, company:companies(*), contact:email_contacts(*)")
    .eq("campaign_id", id)
    .order("created_at", { ascending: false });

  if (aErr) {
    return NextResponse.json({ detail: aErr.message }, { status: 400 });
  }

  return NextResponse.json({ campaign: camp, applications: apps ?? [] });
}
