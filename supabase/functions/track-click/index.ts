import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const redirect = url.searchParams.get("redirect");

  // Paramètres obligatoires
  if (!id || !redirect) {
    return new Response("Missing id or redirect parameter", { status: 400 });
  }

  // Validation basique de l'URL de redirection
  let redirectUrl: URL;
  try {
    redirectUrl = new URL(redirect);
    if (redirectUrl.protocol !== "http:" && redirectUrl.protocol !== "https:") {
      throw new Error("Invalid protocol");
    }
  } catch {
    return new Response("Invalid redirect URL", { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Met à jour clicked_at seulement si pas encore cliqué (premier clic uniquement)
  await supabase
    .from("email_tracking")
    .update({ clicked_at: new Date().toISOString() })
    .eq("id", id)
    .is("clicked_at", null);

  // Redirige vers l'URL cible
  return new Response(null, {
    status: 302,
    headers: { Location: redirectUrl.toString() },
  });
});
