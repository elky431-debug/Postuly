"use client";

import { LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";

type ViewMode = "list" | "swipe";

type SwipeModeProps = {
  mode: ViewMode;
  onModeChange: (m: ViewMode) => void;
};

/** Bascule Liste / Swipe (swipe = bientôt). */
export function SwipeMode({ mode, onModeChange }: SwipeModeProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Vue</span>
      <div className="inline-flex rounded-lg border border-neutral-200 bg-neutral-100 p-0.5">
        <button
          type="button"
          onClick={() => onModeChange("list")}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            mode === "list" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-600 hover:text-neutral-900"
          )}
        >
          <List className="h-3.5 w-3.5" aria-hidden />
          Liste
        </button>
        <button
          type="button"
          disabled
          title="Bientôt disponible"
          className="relative inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-neutral-400"
        >
          <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
          Swipe
          <span className="ml-1 rounded bg-orange-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#EA580C]">
            Bientôt
          </span>
        </button>
      </div>
    </div>
  );
}
