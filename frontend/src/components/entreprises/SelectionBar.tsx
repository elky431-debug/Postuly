"use client";

import { ClipboardList, Plus } from "lucide-react";

type SelectionBarProps = {
  /** Nombre de lignes cochées dans le tableau. */
  checkedCount: number;
  /** Nombre d’entreprises dans la sélection persistée. */
  selectionCount: number;
  onAddChecked: () => void;
  onOpenSelection: () => void;
};

/** Barre sticky : ajouter la sélection + accès « Ma sélection ». */
export function SelectionBar({
  checkedCount,
  selectionCount,
  onAddChecked,
  onOpenSelection,
}: SelectionBarProps) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 bg-white/95 px-4 py-3 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] backdrop-blur-md md:left-[220px]"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          disabled={checkedCount === 0}
          onClick={onAddChecked}
          className="inline-flex items-center gap-2 rounded-xl bg-[#F97316] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_0_20px_rgba(249,115,22,0.15)] transition hover:bg-[#EA6C0A] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
          Ajouter la sélection ({checkedCount})
        </button>
        <button
          type="button"
          onClick={onOpenSelection}
          className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-50"
        >
          <ClipboardList className="h-4 w-4" aria-hidden />
          Ma sélection ({selectionCount})
        </button>
      </div>
    </div>
  );
}
