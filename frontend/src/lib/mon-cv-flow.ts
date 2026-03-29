/**
 * Parcours Mon CV (ordre : import → infos extraites → vérification → analyse coach → campagnes → hub au retour).
 * Stockage par utilisateur dans localStorage.
 */

import { loadCoachCache } from "@/lib/cv-coach-cache";

export type MonCvFlowStep =
  | "import"
  | "extracted_gate"
  | "verify"
  | "before_coach"
  | "completed";

const KEY = (uid: string) => `postuly_moncv_flow_${uid}`;

export function getMonCvFlowStep(userId: string | null, hasParsedCv: boolean): MonCvFlowStep {
  if (!userId || typeof window === "undefined") {
    return hasParsedCv ? "extracted_gate" : "import";
  }
  try {
    const v = localStorage.getItem(KEY(userId));
    if (
      v === "extracted_gate" ||
      v === "verify" ||
      v === "before_coach" ||
      v === "completed"
    ) {
      return v;
    }
  } catch {
    /* ignore */
  }
  const cached = loadCoachCache(userId);
  if (cached?.analysis && cached.viewed) {
    return "completed";
  }
  return hasParsedCv ? "extracted_gate" : "import";
}

export function setMonCvFlowStep(userId: string | null, step: MonCvFlowStep): void {
  if (!userId) return;
  try {
    localStorage.setItem(KEY(userId), step);
  } catch {
    /* ignore */
  }
}

export function resetMonCvFlow(userId: string | null): void {
  if (!userId) return;
  try {
    localStorage.removeItem(KEY(userId));
  } catch {
    /* ignore */
  }
}
