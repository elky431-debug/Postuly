"use client";

import type { LucideIcon } from "lucide-react";
import { useCountUp } from "@/hooks/useCountUp";
import { cn } from "@/lib/utils";

type StatCardProps = {
  label: string;
  countTarget: number;
  isPercent?: boolean;
  accent: string;
  Icon: LucideIcon;
  hasTrendData?: boolean;
};

export function StatCard({
  label,
  countTarget,
  isPercent,
  accent,
  Icon,
  hasTrendData = false,
}: StatCardProps) {
  const animated = useCountUp(countTarget, 1000);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-white shadow-[0_2px_12px_rgba(0,0,0,0.05)] ring-1 ring-stone-100">
      <div className="absolute inset-x-0 top-0 h-[2px]" style={{ background: accent }} />
      <div className="p-5 pt-6">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-stone-400">{label}</p>
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ background: `${accent}18` }}>
            <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: accent }} strokeWidth={2} aria-hidden />
          </div>
        </div>
        <p
          className="mt-4 text-[40px] font-extrabold leading-none tracking-tight text-stone-900 tabular-nums"
          style={{ fontFamily: "var(--font-syne)" }}
        >
          {isPercent ? `${animated}%` : animated}
        </p>
        <p
          className={cn("mt-3 text-[11px] font-medium tabular-nums", hasTrendData ? "" : "text-stone-400")}
          style={hasTrendData ? { color: accent } : undefined}
        >
          {hasTrendData ? "↑ +0% vs semaine dernière" : "— En attente de données"}
        </p>
      </div>
    </div>
  );
}
