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
  const animated = useCountUp(countTarget, 1200);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-[0_14px_30px_-28px_rgba(15,23,42,0.6)] transition-all hover:-translate-y-0.5 hover:border-orange-200">
      <div
        className="flex h-10 w-10 items-center justify-center rounded-xl ring-1 ring-black/[0.04]"
        style={{ backgroundColor: `${accent}12` }}
      >
        <Icon className="h-[17px] w-[17px]" style={{ color: accent }} strokeWidth={2} aria-hidden />
      </div>

      <p className="mt-5 text-[34px] font-semibold tabular-nums leading-none tracking-tight text-stone-900">
        {isPercent ? `${animated}%` : animated}
      </p>
      <p className="mt-1.5 text-[13px] font-medium text-stone-500">{label}</p>

      <p
        className={cn("mt-3 text-[11px] tabular-nums", !hasTrendData && "text-stone-400")}
        style={hasTrendData ? { color: accent } : undefined}
      >
        {hasTrendData ? "↑ +0% vs semaine dernière" : "En attente de données"}
      </p>
    </div>
  );
}
