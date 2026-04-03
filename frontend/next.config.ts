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

/**
 * Netlify / backends définissent souvent SUPABASE_URL + SUPABASE_ANON_KEY sans préfixe.
 * Le navigateur ne voit que NEXT_PUBLIC_* : on recopie au build pour le bundle client.
 * (La clé anon est conçue pour être publique ; ne jamais exposer SERVICE_ROLE côté client.)
 */
const resolvedSupabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
  process.env.SUPABASE_URL?.trim() ||
  "";
const resolvedSupabaseAnon =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  process.env.SUPABASE_ANON_KEY?.trim() ||
  "";
const resolvedSupabasePublishable =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ||
  "";

const supabaseClientEnv: Record<string, string> = {};
if (resolvedSupabaseUrl) supabaseClientEnv.NEXT_PUBLIC_SUPABASE_URL = resolvedSupabaseUrl;
if (resolvedSupabaseAnon) supabaseClientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY = resolvedSupabaseAnon;
if (resolvedSupabasePublishable) {
  supabaseClientEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = resolvedSupabasePublishable;
}

const nextConfig: NextConfig = {
  env: supabaseClientEnv,
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
