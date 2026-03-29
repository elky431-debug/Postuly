import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { EntrepriseSearchResult } from "@/types/entreprise";

/** Données persistées pour les candidatures spontanées (hors `selected`). */
export type EntrepriseSelection = Omit<EntrepriseSearchResult, "selected">;

interface SelectionStore {
  selection: EntrepriseSelection[];
  ajouterEntreprise: (e: EntrepriseSelection) => void;
  retirerEntreprise: (siret: string) => void;
  viderSelection: () => void;
  isSelected: (siret: string) => boolean;
}

export const useSelectionStore = create<SelectionStore>()(
  persist(
    (set, get) => ({
      selection: [],
      ajouterEntreprise: (e) =>
        set((s) => ({
          selection: s.selection.find((x) => x.siret === e.siret) ? s.selection : [...s.selection, e],
        })),
      retirerEntreprise: (siret) =>
        set((s) => ({
          selection: s.selection.filter((x) => x.siret !== siret),
        })),
      viderSelection: () => set({ selection: [] }),
      isSelected: (siret) => get().selection.some((x) => x.siret === siret),
    }),
    { name: "postuly-selection" }
  )
);
