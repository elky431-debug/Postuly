import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer /i, "");
  const user  = await getUserFromRequest(token);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("applications")
    .select(`
      id, campaign_id, company_id, contact_id, cover_letter,
      status, sent_at, replied_at, notes, created_at,
      company:companies(id, name, address, city, postal_code, naf_code, naf_label, size_range, website_url),
      campaign:campaigns(job_title, contract_type, location)
    `)
    .eq("campaigns.user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}
