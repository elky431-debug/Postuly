import { NextRequest, NextResponse } from "next/server";
import {
  BACKEND_PROXY_MISSING_DETAIL,
  getBackendProxyBase,
} from "@/lib/backend-proxy-url";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const base = getBackendProxyBase();
  if (!base) {
    return NextResponse.json({ detail: BACKEND_PROXY_MISSING_DETAIL }, { status: 503 });
  }
  const url = `${base}/api/campaigns/from-selection`;

  const cookieHeader = req.headers.get("cookie") || "";
  const authHeader = req.headers.get("authorization");

  let token = authHeader;
  if (!token) {
    const match = cookieHeader.match(/sb-[^-]+-auth-token=([^;]+)/);
    if (match) {
      try {
        const decoded = JSON.parse(decodeURIComponent(match[1]));
        token = `Bearer ${decoded.access_token}`;
      } catch {
        /* ignore */
      }
    }
  }

  let body: string;
  try {
    body = await req.text();
  } catch (e) {
    return NextResponse.json(
      { detail: e instanceof Error ? e.message : "Lecture du corps de requête impossible" },
      { status: 400 }
    );
  }

  /* Génération des lettres IA : peut être longue ; sans plafond le client reste bloqué sans message. */
  const backendTimeoutMs = 180_000;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: token } : {}),
      },
      body,
      signal: AbortSignal.timeout(backendTimeoutMs),
    });
  } catch (e) {
    const name = e instanceof Error ? e.name : "";
    if (name === "TimeoutError" || name === "AbortError") {
      return NextResponse.json(
        {
          detail: `FastAPI n'a pas répondu sous ${backendTimeoutMs / 1000}s (génération des lettres). Vérifie le backend et les clés API (IA).`,
        },
        { status: 504 }
      );
    }
    const msg =
      e instanceof Error ? e.message : String(e);
    const hint =
      process.env.NODE_ENV === "development"
        ? "Lance le backend : cd backend && bash run-dev.sh"
        : "Vérifie que BACKEND_PROXY_URL est joignable en HTTPS depuis Internet.";
    return NextResponse.json(
      { detail: `Impossible de joindre FastAPI sur ${base} (${msg}). ${hint}` },
      { status: 503 }
    );
  }

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("content-type") || "application/json",
    },
  });
}
