import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, createSupabaseFromBearer } from "@/lib/supabase/server";

/** Indique si Gmail est connecté pour l’utilisateur (sans exposer les tokens). */
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

  const { data, error } = await client
    .from("gmail_tokens")
    .select("gmail_email, connected_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Lecture impossible" }, { status: 500 });
  }

  return NextResponse.json({
    connected: Boolean(data),
    email: data?.gmail_email ?? null,
    connectedAt: data?.connected_at ?? null,
  });
}
