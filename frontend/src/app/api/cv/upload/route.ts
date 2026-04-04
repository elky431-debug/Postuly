import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  BACKEND_PROXY_MISSING_DETAIL,
  getBackendProxyBase,
} from "@/lib/backend-proxy-url";

export const runtime = "nodejs";

const MAX_MB = 10;

function mediaType(
  file: File
): "application/pdf" | "application/vnd.openxmlformats-officedocument.wordprocessingml.document" | null {
  const n = file.name.toLowerCase();
  const t = (file.type || "").toLowerCase();
  if (n.endsWith(".pdf") || t === "application/pdf") return "application/pdf";
  if (
    n.endsWith(".docx") ||
    t.includes("wordprocessingml") ||
    t === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  return null;
}

/**
 * Import CV : enregistrement **direct** sur Supabase Storage (bucket « cvs ») + `profiles.cv_url`,
 * puis appel FastAPI pour le parsing IA (cv_parsed / cv_score).
 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!bearer) {
    return NextResponse.json({ detail: "Authentification requise (Bearer)." }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!supabaseUrl || !anonKey) {
    return NextResponse.json(
      { detail: "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY manquants." },
      { status: 503 }
    );
  }

  const sbUser = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userRes, error: userErr } = await sbUser.auth.getUser(bearer);
  if (userErr || !userRes.user) {
    return NextResponse.json({ detail: "Session invalide ou expirée." }, { status: 401 });
  }
  const userId = userRes.user.id;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      {
        detail:
          "SUPABASE_SERVICE_ROLE_KEY manquant dans .env.local — requis pour enregistrer le fichier sur Storage.",
      },
      { status: 503 }
    );
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ detail: "Champ « file » manquant." }, { status: 400 });
  }

  const media = mediaType(file);
  if (!media) {
    return NextResponse.json({ detail: "Format non supporté (PDF ou DOCX)." }, { status: 400 });
  }
  if (file.size > MAX_MB * 1024 * 1024) {
    return NextResponse.json({ detail: `Fichier trop volumineux (max ${MAX_MB} Mo).` }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const ext = media === "application/pdf" ? ".pdf" : ".docx";
  const storagePath = `${userId}/${randomUUID()}${ext}`;

  const { error: upErr } = await admin.storage.from("cvs").upload(storagePath, bytes, {
    contentType: media,
    upsert: true,
  });
  if (upErr) {
    return NextResponse.json(
      {
        detail: `Échec enregistrement sur Supabase Storage : ${upErr.message}. Exécute backend/app/db/storage_cvs.sql (bucket « cvs »).`,
      },
      { status: 503 }
    );
  }

  const { data: pub } = admin.storage.from("cvs").getPublicUrl(storagePath);
  const cvUrl = pub.publicUrl;
  if (!cvUrl?.startsWith("http")) {
    return NextResponse.json({ detail: "URL publique Storage invalide." }, { status: 503 });
  }

  const { data: updated, error: profUpErr } = await admin
    .from("profiles")
    .update({ cv_url: cvUrl })
    .eq("id", userId)
    .select("id");

  if (profUpErr) {
    await admin.storage.from("cvs").remove([storagePath]).catch(() => undefined);
    return NextResponse.json({ detail: `Profil : ${profUpErr.message}` }, { status: 502 });
  }

  if (!updated?.length) {
    const { error: insErr } = await admin.from("profiles").insert({ id: userId, cv_url: cvUrl });
    if (insErr) {
      await admin.storage.from("cvs").remove([storagePath]).catch(() => undefined);
      return NextResponse.json({ detail: `Profil : ${insErr.message}` }, { status: 502 });
    }
  }

  const backend = getBackendProxyBase();
  if (!backend) {
    return NextResponse.json(
      {
        detail: `${BACKEND_PROXY_MISSING_DETAIL} Le fichier est bien enregistré (${cvUrl}) mais l’analyse IA nécessite FastAPI.`,
        cv_url: cvUrl,
      },
      { status: 503 }
    );
  }

  const parseFd = new FormData();
  const blob = new Blob([bytes], { type: media });
  parseFd.append("file", blob, file.name || `cv${ext}`);

  const parseRes = await fetch(`${backend}/api/cv/parse-only`, {
    method: "POST",
    headers: { Authorization: `Bearer ${bearer}` },
    body: parseFd,
  });

  if (!parseRes.ok) {
    let detail = (await parseRes.text()).slice(0, 500);
    try {
      const j = JSON.parse(detail) as { detail?: string };
      if (typeof j.detail === "string") detail = j.detail;
    } catch {
      /* corps non JSON */
    }
    return NextResponse.json(
      {
        detail: `CV enregistré sur Supabase (${cvUrl}), mais analyse impossible : ${detail}`,
        cv_url: cvUrl,
      },
      { status: 502 }
    );
  }

  const body = (await parseRes.json()) as {
    parsed: unknown;
    score: number;
    suggestions: string[];
  };

  return NextResponse.json({
    cv_url: cvUrl,
    parsed: body.parsed,
    score: body.score,
    suggestions: body.suggestions ?? [],
  });
}
