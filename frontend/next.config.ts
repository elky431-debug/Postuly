import path from "path";
import type { NextConfig } from "next";

/**
 * Proxy /api → FastAPI en local uniquement (ou si BACKEND_PROXY_URL est défini en prod).
 * Sur Netlify sans BACKEND_PROXY_URL, ne pas réécrire vers 127.0.0.1 (cassait les routes).
 */
const backendProxyExplicit = process.env.BACKEND_PROXY_URL?.replace(/\/$/, "") ?? "";
const backendProxy =
  backendProxyExplicit ||
  (process.env.NODE_ENV === "development" ? "http://127.0.0.1:8000" : "");

const nextConfig: NextConfig = {
  /* Monorepo : évite l’avertissement « multiple lockfiles » (racine + frontend). */
  turbopack: {
    root: path.join(__dirname),
  },
  /**
   * `fallback` : après les routes dynamiques (handlers dans app/api).
   * Un tableau simple `return [...]` est traité comme `afterFiles` et s’applique
   * avant les route handlers API → le proxy global écrasait nos routes Next.
   */
  async rewrites() {
    if (!backendProxy) return [];
    return {
      fallback: [
        {
          source: "/api/:path*",
          destination: `${backendProxy}/api/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
