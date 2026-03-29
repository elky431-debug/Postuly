import path from "path";
import type { NextConfig } from "next";

/** Cible du proxy pour les routes /api (évite CORS Safari → :8000 en local). */
const backendProxy =
  process.env.BACKEND_PROXY_URL?.replace(/\/$/, "") ||
  "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  /* Monorepo : évite l’avertissement « multiple lockfiles » (racine + frontend). */
  turbopack: {
    root: path.join(__dirname),
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendProxy}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
