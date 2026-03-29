"use client";

import * as Checkbox from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type ActivityFiltersProps = {
  activities: { key: string; label: string }[];
  /** Codes / clés d’activité à masquer ; vide = rien à masquer. */
  excludedActivityKeys: Set<string>;
  onActivityChecked: (key: string, visible: boolean) => void;
  tailleOptions: { key: string; label: string }[];
  excludedTailleKeys: Set<string>;
  onTailleChecked: (key: string, visible: boolean) => void;
};

/** Filtres avancés : décocher pour exclure une activité ou une taille. */
export function ActivityFilters({
  activities,
  excludedActivityKeys,
  onActivityChecked,
  tailleOptions,
  excludedTailleKeys,
  onTailleChecked,
}: ActivityFiltersProps) {
  if (activities.length === 0 && tailleOptions.length === 0) return null;

  return (
    <div className="grid gap-8 border-t border-[#1F1F1F] pt-6 lg:grid-cols-2">
      <div>
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[#525252]">
          Activités
        </p>
        <ul className="max-h-48 space-y-2 overflow-y-auto pr-1 text-sm">
          {activities.map(({ key, label }) => {
            const visible = !excludedActivityKeys.has(key);
            return (
              <li key={key}>
                <label
                  className={cn(
                    "flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/[0.04]",
                    visible ? "text-[#F5F5F5]" : "text-[#525252]"
                  )}
                >
                  <Checkbox.Root
                    className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-[#2A2A2A] data-[state=checked]:border-[#F97316] data-[state=checked]:bg-[#F97316]/20"
                    checked={visible}
                    onCheckedChange={(c) => onActivityChecked(key, c === true)}
                  >
                    <Checkbox.Indicator>
                      <Check className="h-3 w-3 text-[#F97316]" strokeWidth={3} />
                    </Checkbox.Indicator>
                  </Checkbox.Root>
                  <span className="leading-snug">{label}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>
      <div>
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[#525252]">
          Tailles
        </p>
        <ul className="space-y-2 text-sm">
          {tailleOptions.map(({ key, label }) => {
            const visible = !excludedTailleKeys.has(key);
            return (
              <li key={key}>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/[0.04]">
                  <Checkbox.Root
                    className="flex h-4 w-4 items-center justify-center rounded border border-[#2A2A2A] data-[state=checked]:border-[#F97316] data-[state=checked]:bg-[#F97316]/20"
                    checked={visible}
                    onCheckedChange={(c) => onTailleChecked(key, c === true)}
                  >
                    <Checkbox.Indicator>
                      <Check className="h-3 w-3 text-[#F97316]" strokeWidth={3} />
                    </Checkbox.Indicator>
                  </Checkbox.Root>
                  <span className={cn("text-[#A3A3A3]", !visible && "line-through opacity-50")}>{label}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
