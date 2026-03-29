/**
 * Cache navigateur de la dernière analyse coach (réaffichage hub Mon CV sans refaire l’appel IA).
 */

import type { Campaign, CvCoachAnalysis } from "@/lib/types";

const STORAGE_KEY = "postuly_cv_coach_v1";

export type CoachCachePayload = {
  userId: string;
  analysis: CvCoachAnalysis;
  poste: string;
  contrat: Campaign["contract_type"] | "";
  profilHint: "" | "etudiant" | "jeune_actif" | "reconversion";
  /** True après que l’utilisateur a quitté la page en voyant les résultats → prochaine visite = hub Jobea. */
  viewed: boolean;
};

export function loadCoachCache(userId: string): CoachCachePayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as CoachCachePayload;
    if (!o || o.userId !== userId || !o.analysis) return null;
    return o;
  } catch {
    return null;
  }
}

export function saveCoachCache(payload: CoachCachePayload): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

/** Après consultation des résultats (ex. navigation hors de Mon CV). */
export function markCoachCacheViewed(userId: string): void {
  const cur = loadCoachCache(userId);
  if (!cur) return;
  saveCoachCache({ ...cur, viewed: true });
}

export function clearCoachCache(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
