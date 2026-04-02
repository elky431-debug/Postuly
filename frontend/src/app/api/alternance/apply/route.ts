import { NextRequest, NextResponse } from "next/server";
import { sendCandidatureLba } from "@/lib/lba";
import { getUserFromRequest } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

interface ApplyBody {
  recipientId: string;  // apply.recipient_id from LBA search response
  jobId:       string;  // for DB logging
  jobType:     "recruteur_lba" | "offre_lba";
  siret?:      string;
  companyName: string;
  romeCode:    string;
  city?:       string;
  message?:    string;
}

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const token = req.headers.get("authorization")?.replace(/^Bearer /i, "");
  const user  = await getUserFromRequest(token);
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // ── Body ──────────────────────────────────────────────────────────────────
  let body: ApplyBody;
  try {
    body = (await req.json()) as ApplyBody;
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 });
  }

  const { recipientId, jobId, jobType, siret, companyName, romeCode, city, message } = body;
  if (!recipientId || !jobId || !jobType || !companyName || !romeCode) {
    return NextResponse.json(
      { error: "recipientId, jobId, jobType, companyName et romeCode sont requis" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // ── Duplicat check ────────────────────────────────────────────────────────
  const { data: existing } = await admin
    .from("lba_applications")
    .select("id")
    .eq("user_id", user.id)
    .eq("job_id",  jobId)
    .eq("job_type", jobType)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "Tu as déjà postulé à cette entreprise via Postuly." },
      { status: 409 }
    );
  }

  // ── Profil utilisateur (nom, téléphone, CV) ───────────────────────────────
  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("full_name, cv_url, cv_parsed")
    .eq("id", user.id)
    .single();

  if (profileErr || !profile) {
    return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });
  }
  if (!profile.cv_url) {
    return NextResponse.json(
      { error: "Aucun CV trouvé. Uploade d'abord ton CV dans la section « Mon CV »." },
      { status: 422 }
    );
  }

  // Extraire prénom / nom
  const fullName  = (profile.full_name ?? "").trim() || (user.email ?? "Candidat");
  const nameParts = fullName.split(/\s+/);
  const firstName = nameParts[0] ?? "Candidat";
  const lastName  = nameParts.slice(1).join(" ") || ".";

  // Email et téléphone depuis cv_parsed ou auth
  const parsed    = profile.cv_parsed as { email?: string; phone?: string } | null;
  const email     = parsed?.email || user.email || "";
  const phone     = parsed?.phone || "0600000000";

  // ── Téléchargement du CV → base64 ────────────────────────────────────────
  let cvBase64: string;
  try {
    const cvRes = await fetch(profile.cv_url as string, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!cvRes.ok) {
      throw new Error(`HTTP ${cvRes.status}`);
    }
    const buf = await cvRes.arrayBuffer();
    cvBase64 = Buffer.from(buf).toString("base64");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Impossible de récupérer ton CV (${msg}). Essaie de re-uploader ton CV.` },
      { status: 422 }
    );
  }

  // ── Envoi via API LBA ─────────────────────────────────────────────────────
  const lbaResult = await sendCandidatureLba(recipientId, {
    firstName,
    lastName,
    email,
    phone,
    cvBase64,
    cvFileName: "cv.pdf",
    message: message?.trim() || undefined,
  });

  if (!lbaResult.ok) {
    return NextResponse.json(
      { error: lbaResult.error ?? "L'API LBA a refusé la candidature." },
      { status: 502 }
    );
  }

  // ── Log en base ───────────────────────────────────────────────────────────
  await admin.from("lba_applications").insert({
    user_id:      user.id,
    job_id:       jobId,
    job_type:     jobType,
    siret:        siret ?? null,
    company_name: companyName,
    rome_code:    romeCode,
    city:         city ?? null,
    status:       "envoyee",
  });

  return NextResponse.json({ ok: true, message: `Candidature envoyée à ${companyName}` });
}
