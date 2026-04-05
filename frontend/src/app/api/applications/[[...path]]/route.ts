import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// GET /api/applications/         → liste toutes les candidatures de l'user
// PATCH /api/applications/{id}   → met à jour le statut
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> }
) {
  const token = req.headers.get("authorization")?.replace(/^Bearer /i, "");
  const user  = await getUserFromRequest(token);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const admin = createAdminClient();

  // Récupère toutes les candidatures via les campagnes de l'utilisateur
  const { data, error } = await admin
    .from("applications")
    .select(`
      id, campaign_id, company_id, contact_id, cover_letter,
      status, sent_at, replied_at, notes, created_at,
      company:companies(id, name, address, city, postal_code, naf_code, naf_label, size_range, website_url),
      campaign:campaigns!inner(job_title, contract_type, location, user_id)
    `)
    .eq("campaign.user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Supprimer le champ user_id de campaign avant de renvoyer
  type CampaignRow = { job_title: unknown; contract_type: unknown; location: unknown; user_id: unknown };
  const cleaned = (data ?? []).map((a) => {
    const c = (a.campaign as CampaignRow[] | CampaignRow | null);
    const cam = Array.isArray(c) ? c[0] : c;
    return {
      ...a,
      campaign: cam ? { job_title: cam.job_title, contract_type: cam.contract_type, location: cam.location } : null,
    };
  });

  return NextResponse.json(cleaned);
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> }
) {
  const token = req.headers.get("authorization")?.replace(/^Bearer /i, "");
  const user  = await getUserFromRequest(token);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { path } = await ctx.params;
  const id = path?.[0];
  if (!id) return NextResponse.json({ error: "ID manquant" }, { status: 400 });

  const body = await req.json() as Record<string, unknown>;
  const admin = createAdminClient();

  const { error } = await admin
    .from("applications")
    .update(body)
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> }
) {
  const token = req.headers.get("authorization")?.replace(/^Bearer /i, "");
  const user  = await getUserFromRequest(token);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json() as Record<string, unknown>;
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("applications")
    .insert({ ...body })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}
