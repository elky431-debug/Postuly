/**
 * Résolution code postal ↔ ville via la Base Adresse Nationale (data.gouv), sans clé API.
 */

const BAN_SEARCH = "https://api-adresse.data.gouv.fr/search/";

type BanFeature = {
  properties?: {
    city?: string;
    name?: string;
    postcode?: string;
  };
};

/** Retire les accents pour comparer « Saint-Étienne » et « saint etienne ». */
function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim();
}

/**
 * Retourne un code postal à 5 chiffres si la BAN reconnaît la commune, sinon null.
 */
export async function fetchPostcodeForFrenchCity(
  city: string,
  signal?: AbortSignal
): Promise<string | null> {
  const q = city.trim();
  if (q.length < 2) return null;

  const params = new URLSearchParams({
    q,
    type: "municipality",
    limit: "10",
  });

  let res: Response;
  try {
    res = await fetch(`${BAN_SEARCH}?${params}`, { signal });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  const data = (await res.json()) as { features?: BanFeature[] };
  const features = data.features ?? [];
  if (features.length === 0) return null;

  const target = fold(q);

  const exact = features.find((f) => {
    const label = f.properties?.city || f.properties?.name;
    return label && fold(label) === target;
  });

  const prefix = features.find((f) => {
    const label = f.properties?.city || f.properties?.name;
    return label && fold(label).startsWith(target);
  });

  const pick = exact ?? prefix ?? features[0];
  const pc = pick.properties?.postcode?.trim();
  if (pc && /^\d{5}$/.test(pc)) return pc;
  return null;
}
