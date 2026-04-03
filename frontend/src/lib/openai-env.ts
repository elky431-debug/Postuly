import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Résout OPENAI_API_KEY pour les routes API Next.
 * 1) Variable d’environnement (ex. `frontend/.env.local`)
 * 2) En développement local : lecture de `backend/.env` (monorepo Postuly)
 *
 * En production (Vercel, etc.), seule la variable d’environnement est utilisée.
 */
export function resolveOpenAiApiKey(): string {
  const fromEnv = process.env.OPENAI_API_KEY?.trim();
  if (fromEnv) return fromEnv;

  const isProd =
    process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
  if (isProd) return "";

  const candidates = [
    path.resolve(process.cwd(), "..", "backend", ".env"),
    path.resolve(process.cwd(), "backend", ".env"),
  ];

  for (const envPath of candidates) {
    try {
      const raw = readFileSync(envPath, "utf8");
      for (const line of raw.split("\n")) {
        const t = line.trim();
        if (!t || t.startsWith("#")) continue;
        const eq = t.indexOf("=");
        if (eq === -1) continue;
        const key = t.slice(0, eq).trim();
        if (key !== "OPENAI_API_KEY") continue;
        let val = t.slice(eq + 1).trim();
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        return val;
      }
    } catch {
      /* fichier absent */
    }
  }

  return "";
}
