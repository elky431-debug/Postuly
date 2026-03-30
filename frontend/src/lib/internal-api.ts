import type { NextRequest } from "next/server";

/** Vérifie la clé partagée avec n8n (header x-internal-key). */
export function verifierCleInterne(req: NextRequest): boolean {
  const expected = process.env.INTERNAL_API_KEY?.trim();
  if (!expected) return false;
  return req.headers.get("x-internal-key") === expected;
}
