/** Mois en toutes lettres (fr), pour affichage CV et récap. */
const MOIS_COMPLETS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
] as const;

/** « juillet 2025 » à partir d’une date ISO (YYYY-MM ou YYYY-MM-DD). */
export function formatMonthYearFr(isoDate: string): string {
  const t = isoDate?.trim();
  if (!t) return "";
  const normalized = /^\d{4}-\d{2}$/.test(t) ? `${t}-01` : t;
  const d = new Date(`${normalized}T12:00:00`);
  if (Number.isNaN(d.getTime())) return t;
  return `${MOIS_COMPLETS[d.getMonth()]} ${d.getFullYear()}`;
}

/** « 25 juillet 2025 » si jour présent, sinon comme formatMonthYearFr. */
export function formatDateEcriteFr(isoDate: string): string {
  const t = isoDate?.trim();
  if (!t) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    const d = new Date(`${t}T12:00:00`);
    if (Number.isNaN(d.getTime())) return t;
    return `${d.getDate()} ${MOIS_COMPLETS[d.getMonth()]} ${d.getFullYear()}`;
  }
  return formatMonthYearFr(t);
}

export function formatPeriodFr(start: string, end: string): string {
  const a = formatDateEcriteFr(start);
  const b = formatDateEcriteFr(end);
  if (a && b) return `${a} – ${b}`;
  if (a) return a;
  if (b) return b;
  return "";
}

/**
 * Normalise une période libre (IA ou saisie) : segments type ISO ou JJ/MM/AAAA → toutes lettres.
 */
export function formatPeriodeEcriteFr(periode: string): string {
  const raw = periode?.trim();
  if (!raw) return "";

  const trySegment = (segment: string): string => {
    const s = segment.trim();
    if (!s) return s;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return formatDateEcriteFr(s);
    if (/^\d{4}-\d{2}$/.test(s)) return formatMonthYearFr(s);
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
      const [da, mo, ye] = s.split("/").map((x) => parseInt(x, 10));
      if (!Number.isFinite(da) || !Number.isFinite(mo) || !Number.isFinite(ye)) return s;
      const d = new Date(ye, mo - 1, da);
      if (Number.isNaN(d.getTime())) return s;
      return `${d.getDate()} ${MOIS_COMPLETS[d.getMonth()]} ${d.getFullYear()}`;
    }
    return s;
  };

  const parts = raw.split(/\s*[–—-]\s*/).map(trySegment);
  const filtered = parts.filter(Boolean);
  if (filtered.length >= 2) return `${filtered[0]} – ${filtered[1]}`;
  if (filtered.length === 1) return filtered[0];
  return raw;
}
