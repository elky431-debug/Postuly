import { createClient } from "@/lib/supabase";

type SupabaseBrowser = ReturnType<typeof createClient>;

/**
 * JWT pour l’API FastAPI. `getSession()` peut être vide au premier tick avant
 * hydratation du stockage navigateur — on tente refresh puis un court délai.
 */
export async function getAccessTokenForApi(
  supabase: SupabaseBrowser
): Promise<string | null> {
  let {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    const { data } = await supabase.auth.refreshSession();
    session = data.session ?? null;
  }

  if (session?.access_token) {
    return session.access_token;
  }

  await new Promise((r) => setTimeout(r, 200));
  const {
    data: { session: late },
  } = await supabase.auth.getSession();
  return late?.access_token ?? null;
}
