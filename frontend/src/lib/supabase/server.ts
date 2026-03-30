import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function getAnonKey(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ??
    ""
  );
}

/**
 * Client Supabase pour une requête entrante : JWT utilisateur (Authorization Bearer).
 * À utiliser quand la session n’est pas en cookie (ex. createBrowserClient + localStorage).
 */
export function createSupabaseFromBearer(accessToken: string | undefined): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const anon = getAnonKey();
  if (!url || !anon || !accessToken?.trim()) return null;
  return createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${accessToken.trim()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Récupère l’utilisateur à partir du header Authorization. */
export async function getUserFromRequest(
  accessToken: string | undefined
): Promise<{ id: string; email?: string } | null> {
  const client = createSupabaseFromBearer(accessToken);
  if (!client) return null;
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) return null;
  return { id: user.id, email: user.email ?? undefined };
}
