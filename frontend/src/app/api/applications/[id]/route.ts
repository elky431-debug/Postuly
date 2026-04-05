import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("authorization")?.replace(/^Bearer /i, "");
  const user  = await getUserFromRequest(token);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await params;
  const body = await req.json() as Record<string, unknown>;

  const admin = createAdminClient();
  const { error } = await admin
    .from("applications")
    .update(body)
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
