import { createHmac, timingSafeEqual } from "crypto";

/** Paramètre OAuth `state` signé (userId + expiration) — pas de JWT dans l’URL. */
export function signerStateOAuth(userId: string, ttlMs: number = 600_000): string {
  const secret = process.env.INTERNAL_API_KEY?.trim();
  if (!secret) {
    throw new Error("INTERNAL_API_KEY manquant pour signer le state OAuth");
  }
  const exp = Date.now() + ttlMs;
  const payload = Buffer.from(JSON.stringify({ userId, exp }), "utf8").toString("base64url");
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifierStateOAuth(state: string | null): { userId: string } | null {
  if (!state || !state.includes(".")) return null;
  const secret = process.env.INTERNAL_API_KEY?.trim();
  if (!secret) return null;
  const dot = state.lastIndexOf(".");
  const payload = state.slice(0, dot);
  const sig = state.slice(dot + 1);
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  try {
    const a = Buffer.from(sig, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      userId?: string;
      exp?: number;
    };
    if (!data.userId || typeof data.exp !== "number" || Date.now() > data.exp) return null;
    return { userId: data.userId };
  } catch {
    return null;
  }
}
