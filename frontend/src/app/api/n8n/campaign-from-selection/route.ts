import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";

function backendBase(): string {
  return (
    process.env.BACKEND_PROXY_URL?.replace(/\/$/, "") ||
    process.env.BACKEND_INTERNAL_URL?.replace(/\/$/, "") ||
    "http://127.0.0.1:8000"
  );
}

export async function POST(req: NextRequest) {
  const url = `${backendBase()}/api/campaigns/from-selection`;

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

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: token } : {}),
      },
      body,
    });
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        detail:
          `Impossible de joindre FastAPI sur ${backendBase()} (${msg}). ` +
          "Lance le backend : cd backend && bash run-dev.sh",
      },
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
