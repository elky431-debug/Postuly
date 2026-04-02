import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, createSupabaseFromBearer } from "@/lib/supabase/server";
import type { RelanceApplicationUiStatus, RelanceLetterPayload } from "@/types/relance";

function mapUiStatus(status: string): RelanceApplicationUiStatus {
  if (status === "followed_up") return "relanced";
  if (["replied", "interview", "offer"].includes(status)) return "replied";
  return "no_reply";
}

/**
 * Lecture / mise à jour de la lettre (texte) pour une candidature.
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

  const { data: app, error } = await client
    .from("applications")
    .select("id, status, cover_letter, sent_at, created_at, campaign_id, company:companies(name)")
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

  const co = app.company as { name?: string } | { name?: string }[] | null;
  const companyName = Array.isArray(co) ? co[0]?.name ?? "Entreprise" : co?.name ?? "Entreprise";
  const st = app.status as string;
  const subjectInitial = `Candidature spontanée — ${companyName}`;
  const subjectRelance = `Relance — ${companyName}`;

  const payload: RelanceLetterPayload = {
    subjectInitial,
    subjectRelance,
    body: (app.cover_letter as string) ?? "",
    sentAt: (app.sent_at as string) ?? null,
    createdAt: app.created_at as string,
    uiStatus: mapUiStatus(st),
    companyName,
    rawStatus: st,
  };

  return NextResponse.json(payload);
}

export async function PUT(
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

  let bodyText = "";
  try {
    const b = await req.json();
    bodyText = typeof b.body === "string" ? b.body : "";
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const BACKEND = (process.env.BACKEND_PROXY_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
  const res = await fetch(`${BACKEND}/api/applications/${id}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ cover_letter: bodyText }),
  });

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("content-type") || "application/json" },
  });
}
