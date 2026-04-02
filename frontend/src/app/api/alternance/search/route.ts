import { NextRequest, NextResponse } from "next/server";
import { searchOpportunites, geocodeCity } from "@/lib/lba";
import { getUserFromRequest } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sp     = req.nextUrl.searchParams;
  const rome   = sp.get("rome");
  const city   = sp.get("city");
  const latP   = sp.get("lat");
  const lngP   = sp.get("lng");
  const radius = Math.min(Number(sp.get("radius") ?? "30"), 100);

  if (!rome) {
    return NextResponse.json({ error: "Paramètre 'rome' requis" }, { status: 400 });
  }

  // ── Résoudre les coordonnées ──────────────────────────────────────────────
  let lat: number;
  let lng: number;
  let cityLabel = city ?? "";

  if (latP && lngP) {
    lat = Number(latP);
    lng = Number(lngP);
  } else if (city) {
    const geo = await geocodeCity(city);
    if (!geo) {
      return NextResponse.json(
        { error: `Ville introuvable : "${city}". Essaie avec le département (ex. "Paris 75").` },
        { status: 422 }
      );
    }
    lat      = geo.lat;
    lng      = geo.lng;
    cityLabel = geo.label;
  } else {
    return NextResponse.json(
      { error: "Fournir 'city' ou 'lat' + 'lng'" },
      { status: 400 }
    );
  }

  // ── Appel LBA avec fallback propre ────────────────────────────────────────
  let result;
  try {
    result = await searchOpportunites(rome, lat, lng, radius);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur API LBA";
    // Fallback propre : retourne des listes vides avec le message d'erreur
    return NextResponse.json(
      {
        error:              msg,
        recruteurs:         [],
        offres_lba:         [],
        offres_partenaires: [],
        total:              0,
        cityLabel,
        lat,
        lng,
      },
      { status: 502 }
    );
  }

  // ── Marquer les offres déjà postulées (si authentifié) ───────────────────
  const token = req.headers.get("authorization")?.replace(/^Bearer /i, "");
  let appliedIds = new Set<string>();

  if (token) {
    const user = await getUserFromRequest(token);
    if (user) {
      const admin = createAdminClient();
      const { data } = await admin
        .from("lba_applications")
        .select("job_id")
        .eq("user_id", user.id);
      appliedIds = new Set((data ?? []).map((r: { job_id: string }) => r.job_id));
    }
  }

  const tag = <T extends { id: string }>(items: T[]) =>
    items.map((item) => ({ ...item, already_applied: appliedIds.has(item.id) }));

  return NextResponse.json({
    recruteurs:         tag(result.recruteurs),
    offres_lba:         tag(result.offres_lba),
    offres_partenaires: result.offres_partenaires, // redirection externe, pas de candidature LBA
    total:              result.recruteurs.length + result.offres_lba.length + result.offres_partenaires.length,
    cityLabel,
    lat,
    lng,
  });
}
