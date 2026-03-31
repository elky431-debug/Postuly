import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy explicite vers FastAPI `/api/applications/*`.
 * Le rewrite global `next.config` ne garantit pas la transmission de `Authorization`
 * (d’où « header Authorization manquant » sur le Kanban alors que le client envoie le Bearer).
 */
const BACKEND =
  (process.env.BACKEND_PROXY_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

function backendUrl(pathSegments: string[], search: string): string {
  if (pathSegments.length === 0) {
    return `${BACKEND}/api/applications/${search}`;
  }
  return `${BACKEND}/api/applications/${pathSegments.join("/")}${search}`;
}

async function proxyToBackend(
  req: NextRequest,
  pathSegments: string[],
  method: "GET" | "PATCH" | "POST"
): Promise<NextResponse> {
  const url = backendUrl(pathSegments, req.nextUrl.search);
  const auth = req.headers.get("authorization");
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (auth) {
    headers.Authorization = auth;
  }

  let body: string | undefined;
  if (method === "PATCH" || method === "POST") {
    body = await req.text();
    const ct = req.headers.get("content-type");
    if (ct) {
      headers["Content-Type"] = ct;
    }
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body || undefined,
  });
  const text = await res.text();
  const ctOut = res.headers.get("content-type") || "application/json";
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": ctOut },
  });
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> }
) {
  const { path } = await ctx.params;
  return proxyToBackend(req, path ?? [], "GET");
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> }
) {
  const { path } = await ctx.params;
  return proxyToBackend(req, path ?? [], "PATCH");
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> }
) {
  const { path } = await ctx.params;
  return proxyToBackend(req, path ?? [], "POST");
}
