import { createBrowserClient } from "@supabase/ssr";

/** Clé publique : publishable (nouveau dashboard) ou anon JWT (legacy). */
function getSupabaseKey(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    ""
  );
}

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = getSupabaseKey();

  if (!url || !key) {
    throw new Error(
      "Supabase : définis NEXT_PUBLIC_SUPABASE_URL et " +
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ou NEXT_PUBLIC_SUPABASE_ANON_KEY " +
        "dans frontend/.env.local (voir .env.local.example)."
    );
  }

  return createBrowserClient(url, key);
}
