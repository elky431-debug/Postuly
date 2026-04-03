import { createBrowserClient } from "@supabase/ssr";

/** Clé publique : publishable (nouveau dashboard) ou anon JWT (legacy). */
function getSupabaseKeyRaw(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    ""
  );
}

/** URL + clé prêtes pour le client (trim, même règle partout). */
export function getSupabaseBrowserCredentials(): { url: string; key: string } | null {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const key = getSupabaseKeyRaw().trim();
  if (!url || !key) return null;
  return { url, key };
}

/** True si le client navigateur peut être créé (vars injectées au build). */
export function isSupabaseBrowserConfigured(): boolean {
  return getSupabaseBrowserCredentials() !== null;
}

export function createClient() {
  const creds = getSupabaseBrowserCredentials();
  if (!creds) {
    throw new Error(
      "Supabase : ajoute NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY (ou " +
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) dans Netlify → Site settings → Environment variables " +
        "(Production), puis « Clear cache and deploy ». En local : frontend/.env.local."
    );
  }

  return createBrowserClient(creds.url, creds.key);
}
