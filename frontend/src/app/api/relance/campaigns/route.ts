import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, createSupabaseFromBearer } from "@/lib/supabase/server";
import type { RelanceCampaignSummary, RelanceCampaignUiStatus } from "@/types/relance";

function computeUiStatus(
  sentCount: number,
  repliedCount: number,
  followedUpCount: number,
  totalApplications: number
): RelanceCampaignUiStatus {
  if (totalApplications === 0) return "no_reply";
  if (sentCount > 0 && repliedCount === 0) return "no_reply";
  if (repliedCount > 0) return "partial";
  if (sentCount === 0 && followedUpCount > 0 && repliedCount === 0 && totalApplications > 0) {
    return "completed";
  }
  return "partial";
}

/**
 * Liste des campagnes avec agrégats pour l’écran Relance.
 */
export async function GET(req: NextRequest) {
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

  const { data: campaigns, error: cErr } = await client
    .from("campaigns")
    .select("id, job_title, location, contract_type, status, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (cErr) {
    return NextResponse.json({ detail: cErr.message }, { status: 400 });
  }

  const list = campaigns ?? [];
  if (list.length === 0) {
    return NextResponse.json({ campaigns: [] satisfies RelanceCampaignSummary[] });
  }

  const ids = list.map((c) => c.id as string);

  const { data: apps, error: aErr } = await client
    .from("applications")
    .select("campaign_id, status, sent_at, company:companies(name)")
    .in("campaign_id", ids);

  if (aErr) {
    return NextResponse.json({ detail: aErr.message }, { status: 400 });
  }

  const byCampaign = new Map<
    string,
    {
      total: number;
      sent: number;
      followed: number;
      replied: number;
      lastSent: string | null;
      names: string[];
    }
  >();

  for (const id of ids) {
    byCampaign.set(id, {
      total: 0,
      sent: 0,
      followed: 0,
      replied: 0,
      lastSent: null,
      names: [],
    });
  }

  const repliedStatuses = ["replied", "interview", "offer"];

  for (const row of apps ?? []) {
    const cid = row.campaign_id as string;
    const agg = byCampaign.get(cid);
    if (!agg) continue;
    agg.total += 1;
    const st = row.status as string;
    if (st === "sent") agg.sent += 1;
    if (st === "followed_up") agg.followed += 1;
    if (repliedStatuses.includes(st)) agg.replied += 1;
    if (row.sent_at) {
      const iso = row.sent_at as string;
      if (!agg.lastSent || iso > agg.lastSent) agg.lastSent = iso;
    }
    const co = row.company as { name?: string } | { name?: string }[] | null;
    const name = Array.isArray(co) ? co[0]?.name : co?.name;
    if (name && agg.names.length < 8) agg.names.push(name);
  }

  const campaignsOut: RelanceCampaignSummary[] = list.map((c) => {
    const agg = byCampaign.get(c.id as string)!;
    const created = c.created_at as string;
    const titleDate = new Date(created).toLocaleDateString("fr-FR", {
      month: "short",
      year: "numeric",
    });
    const title = `${(c.job_title as string) || "Campagne"} — ${titleDate}`;
    return {
      id: c.id as string,
      title,
      jobTitle: (c.job_title as string) || "—",
      location: (c.location as string) || "—",
      contractType: (c.contract_type as string) || "—",
      campaignStatus: (c.status as string) || "draft",
      createdAt: created,
      lastSentAt: agg.lastSent,
      totalApplications: agg.total,
      repliedCount: agg.replied,
      followedUpCount: agg.followed,
      sentCount: agg.sent,
      uiStatus: computeUiStatus(agg.sent, agg.replied, agg.followed, agg.total),
      companyNamesSample: agg.names,
    };
  });

  const statusFilter = req.nextUrl.searchParams.get("status")?.trim();
  const dateFilter = req.nextUrl.searchParams.get("date")?.trim();
  const q = req.nextUrl.searchParams.get("q")?.trim().toLowerCase() ?? "";

  let filtered = campaignsOut;

  if (statusFilter === "no_reply") {
    filtered = filtered.filter((x) => x.sentCount > 0 && x.repliedCount === 0);
  } else if (statusFilter === "replied") {
    filtered = filtered.filter((x) => x.repliedCount > 0);
  }

  if (dateFilter === "7d" || dateFilter === "30d") {
    const days = dateFilter === "7d" ? 7 : 30;
    const cutoff = Date.now() - days * 86400000;
    filtered = filtered.filter((x) => new Date(x.createdAt).getTime() >= cutoff);
  }

  if (q) {
    filtered = filtered.filter(
      (x) =>
        x.title.toLowerCase().includes(q) ||
        x.jobTitle.toLowerCase().includes(q) ||
        x.companyNamesSample.some((n) => n.toLowerCase().includes(q))
    );
  }

  return NextResponse.json({ campaigns: filtered });
}
