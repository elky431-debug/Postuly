/**
 * URL FastAPI pour les handlers Next qui proxy vers le backend.
 * Sur Netlify, NODE_ENV vaut « production » : jamais de fallback 127.0.0.1.
 */

export const BACKEND_PROXY_MISSING_DETAIL =
  "Backend FastAPI non configuré : sur Netlify → Environment variables, définis BACKEND_PROXY_URL ou " +
  "BACKEND_URL (URL publique HTTPS, sans slash final), pour Production **et** Deploy Previews si tu testes " +
  "sur une URL du type main--site.netlify.app. Puis redéploie.";

/** localhost / 127.0.0.1 : inutilisable depuis les serveurs Netlify. */
function isUnreachableFromHost(u: string): boolean {
  return /^(https?:\/\/)?(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/i.test(u);
}

/**
 * Sans `https://`, `fetch()` lève « Failed to parse URL » (ex. seulement `xxx.up.railway.app`).
 */
function normalizeProxyBase(raw: string): string {
  const u = raw.trim().replace(/\/$/, "");
  if (!u) return u;
  if (/^https?:\/\//i.test(u)) return u;
  if (/^(127\.0\.0\.1|localhost)/i.test(u)) {
    return `http://${u}`;
  }
  return `https://${u}`;
}

/**
 * En `next dev` (NODE_ENV=development) : fallback localhost si aucune variable.
 * En prod (Netlify, etc.) : uniquement des URLs explicites ; pas de localhost.
 */
export function getBackendProxyBase(): string | null {
  const candidates = [
    process.env.BACKEND_PROXY_URL,
    process.env.BACKEND_URL,
    process.env.BACKEND_INTERNAL_URL,
    process.env.INTERNAL_API_URL,
  ];
  const isDev = process.env.NODE_ENV === "development";

  for (const raw of candidates) {
    const u = raw?.trim().replace(/\/$/, "");
    if (!u) continue;
    if (!isDev && isUnreachableFromHost(u)) continue;
    return normalizeProxyBase(u);
  }

  if (isDev) {
    return "http://127.0.0.1:8000";
  }
  return null;
}
