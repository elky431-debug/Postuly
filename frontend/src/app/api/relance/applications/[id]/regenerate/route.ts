import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/supabase/server";
import {
  BACKEND_PROXY_MISSING_DETAIL,
  getBackendProxyBase,
} from "@/lib/backend-proxy-url";

/**
 * Régénère la lettre via FastAPI (même pipeline que la création de campagne).
 */
export async function POST(
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

  const backend = getBackendProxyBase();
  if (!backend) {
    return NextResponse.json({ detail: BACKEND_PROXY_MISSING_DETAIL }, { status: 503 });
  }
  const res = await fetch(`${backend}/api/applications/${id}/regenerate-cover-letter`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("content-type") || "application/json" },
  });
}
