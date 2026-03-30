"use client";

import { cn } from "@/lib/utils";

type TaillePillProps = {
  label: string;
};

/** Pastille taille d’entreprise (micro, PME, grande…). */
export function TaillePill({ label }: TaillePillProps) {
  const short =
    label.includes("Grande") ? "Grande" : label.includes("Micro") ? "Micro" : label.includes("PME") ? "PME" : label;
  return (
    <span
      className={cn(
        "inline-flex max-w-[9rem] truncate rounded-full border border-neutral-200 bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-700"
      )}
      title={label}
    >
      {short}
    </span>
  );
}
