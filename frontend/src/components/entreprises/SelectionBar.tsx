"use client";

import { useRouter } from "next/navigation";
import { ClipboardList, Plus, ArrowRight } from "lucide-react";

type SelectionBarProps = {
  checkedCount: number;
  selectionCount: number;
  onAddChecked: () => void;
};

/** Barre sticky : ajouter la sélection + accès « Ma sélection ». */
export function SelectionBar({
  checkedCount,
  selectionCount,
  onAddChecked,
}: SelectionBarProps) {
  const router = useRouter();

  function handleValidate() {
    onAddChecked();
    router.push("/dashboard/selections");
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 bg-white/95 px-4 py-3 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] backdrop-blur-md md:left-[220px]"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          disabled={checkedCount === 0}
          onClick={handleValidate}
          className="inline-flex items-center gap-2 rounded-xl bg-[#F97316] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_0_20px_rgba(249,115,22,0.15)] transition hover:bg-[#EA6C0A] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
          Valider la sélection ({checkedCount})
          <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden />
        </button>

        <button
          type="button"
          onClick={() => router.push("/dashboard/selections")}
          className="inline-flex items-center gap-2 rounded-xl border border-[#2A2A2A] bg-[#2A2A2A] px-4 py-2.5 text-sm font-semibold text-[#F5F5F5] transition hover:bg-[#333]"
        >
          <ClipboardList className="h-4 w-4" aria-hidden />
          Ma sélection
          {selectionCount > 0 && (
            <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-orange-500 px-1 text-[11px] font-bold text-white">
              {selectionCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
