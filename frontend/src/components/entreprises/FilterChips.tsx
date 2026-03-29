"use client";

import * as Checkbox from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type TailleCode = "tpe" | "pme" | "grande";

type FilterChipsProps = {
  tailles: Set<TailleCode>;
  onTaillesChange: (next: Set<TailleCode>) => void;
  anciennete: "recent" | "old";
  onAncienneteChange: (v: "recent" | "old") => void;
};

const TAILLE_OPTIONS: { id: TailleCode; label: string }[] = [
  { id: "tpe", label: "Très petite entreprise" },
  { id: "pme", label: "Petite et moyenne entreprise" },
  { id: "grande", label: "Grande entreprise" },
];

/** Filtres taille (TPE / PME / grande) + ancienneté. */
export function FilterChips({
  tailles,
  onTaillesChange,
  anciennete,
  onAncienneteChange,
}: FilterChipsProps) {
  function toggleTaille(id: TailleCode) {
    const next = new Set(tailles);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    if (next.size === 0) next.add(id);
    onTaillesChange(next);
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#525252]">
          Taille
        </p>
        <div className="flex flex-wrap gap-2">
          {TAILLE_OPTIONS.map(({ id, label }) => (
            <label
              key={id}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                tailles.has(id)
                  ? "border-[#F97316] bg-[#F97316]/20 text-[#F97316]"
                  : "border-[#2A2A2A] bg-[#1A1A1A] text-[#737373]"
              )}
            >
              <Checkbox.Root
                className="flex h-4 w-4 items-center justify-center rounded border border-current"
                checked={tailles.has(id)}
                onCheckedChange={() => toggleTaille(id)}
              >
                <Checkbox.Indicator>
                  <Check className="h-3 w-3" strokeWidth={3} />
                </Checkbox.Indicator>
              </Checkbox.Root>
              {label}
            </label>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#525252]">
          Ancienneté
        </p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: "recent" as const, label: "Récentes" },
              { id: "old" as const, label: "Anciennes" },
            ] as const
          ).map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => onAncienneteChange(id)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                anciennete === id
                  ? "border-[#F97316] bg-[#F97316]/20 text-[#F97316]"
                  : "border-[#2A2A2A] bg-[#1A1A1A] text-[#737373] hover:text-[#A3A3A3]"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
