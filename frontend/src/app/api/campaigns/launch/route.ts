import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, createSupabaseFromBearer } from "@/lib/supabase/server";

type CandidatureRow = {
  id: string;
  cover_letter: string | null;
  companies: { name: string } | { name: string }[] | null;
  email_contacts: { email: string } | { email: string }[] | null;
};

function premier<T extends object>(x: T | T[] | null | undefined): T | null {
  if (x == null) return null;
  return Array.isArray(x) ? (x[0] ?? null) : x;
}

/**
 * Envoie le lot de candidatures approuvées au workflow n8n (envoi Gmail espacé).
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

  let campaignId: string | undefined;
  try {
    const b = await req.json();
    campaignId = typeof b.campaignId === "string" ? b.campaignId : undefined;
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  if (!campaignId?.trim()) {
    return NextResponse.json({ error: "campaignId requis" }, { status: 400 });
  }

  const { data: camp, error: campErr } = await client
    .from("campaigns")
    .select("id, user_id")
    .eq("id", campaignId)
    .maybeSingle();

  if (campErr || !camp || camp.user_id !== user.id) {
    return NextResponse.json({ error: "Campagne introuvable" }, { status: 404 });
  }

  const { data: candidatures, error: appErr } = await client
    .from("applications")
    .select(
      `
      id,
      cover_letter,
      companies ( name ),
      email_contacts ( email )
    `
    )
    .eq("campaign_id", campaignId)
    .eq("status", "approved");

  if (appErr) {
    return NextResponse.json({ error: appErr.message }, { status: 500 });
  }

  const rows = (candidatures ?? []) as unknown as CandidatureRow[];
  if (rows.length === 0) {
    return NextResponse.json({ error: "Aucune candidature approuvée" }, { status: 400 });
  }

  const mapped = rows
    .map((c) => {
      const contact = premier(c.email_contacts);
      const company = premier(c.companies);
      const email = contact?.email?.trim();
      if (!email) return null;
      return {
        application_id: c.id,
        email_destinataire: email,
        objet: `Candidature spontanée — ${company?.name ?? "Entreprise"}`,
        lettre_html: c.cover_letter ?? "",
        user_id: user.id,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null);

  if (mapped.length === 0) {
    return NextResponse.json(
      { error: "Aucun contact e-mail sur les candidatures approuvées" },
      { status: 400 }
    );
  }

  const nextjsUrl = process.env.NEXTJS_URL?.trim() ?? "";
  const internalKey = process.env.INTERNAL_API_KEY?.trim() ?? "";
  const n8nUrl = process.env.N8N_WEBHOOK_URL?.trim() ?? "";

  if (!nextjsUrl || !internalKey || !n8nUrl) {
    return NextResponse.json(
      { error: "NEXTJS_URL, INTERNAL_API_KEY ou N8N_WEBHOOK_URL manquant dans .env.local" },
      { status: 503 }
    );
  }

  const payload = {
    nextjs_url: nextjsUrl.replace(/\/$/, ""),
    internal_key: internalKey,
    user_id: user.id,
    candidatures: mapped,
  };

  const n8nRes = await fetch(n8nUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!n8nRes.ok) {
    const t = await n8nRes.text();
    return NextResponse.json(
      { error: "Erreur n8n", detail: t.slice(0, 300) },
      { status: 502 }
    );
  }

  const { error: updErr } = await client
    .from("campaigns")
    .update({ status: "running" })
    .eq("id", campaignId)
    .eq("user_id", user.id);

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    nb_emails: mapped.length,
    message: `${mapped.length} e-mail(s) confié(s) à n8n (cadence définie dans le workflow).`,
  });
}
