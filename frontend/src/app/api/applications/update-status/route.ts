import { NextRequest, NextResponse } from "next/server";
import { verifierCleInterne } from "@/lib/internal-api";
import { createAdminClient } from "@/lib/supabase/admin";

const STATUTS_AUTORISES = new Set([
  "pending_review",
  "approved",
  "sent",
  "followed_up",
  "replied",
  "interview",
  "offer",
  "rejected",
]);

/**
 * Met à jour le statut d’une candidature (appel n8n après envoi).
 */
export async function POST(req: NextRequest) {
  if (!verifierCleInterne(req)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  let body: { applicationId?: string; status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const applicationId = body.applicationId?.trim();
  const status = body.status?.trim();
  if (!applicationId || !status || !STATUTS_AUTORISES.has(status)) {
    return NextResponse.json({ error: "applicationId ou status invalide" }, { status: 400 });
  }

  const admin = createAdminClient();
  const patch: Record<string, unknown> = { status };
  if (status === "sent") {
    patch.sent_at = new Date().toISOString();
  }

  const { error } = await admin.from("applications").update(patch).eq("id", applicationId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
