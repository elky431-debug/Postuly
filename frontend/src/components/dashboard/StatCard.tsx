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
    <motion.div
      initial={false}
      whileHover={{ y: -2, boxShadow: "0 12px 40px -8px rgba(15,23,42,0.1)" }}
      transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="relative overflow-hidden rounded-2xl bg-white ring-1 ring-stone-200/70 transition-shadow"
    >
      {/* Thin accent bar at top */}
      <div
        className="absolute inset-x-0 top-0 h-[2px]"
        style={{ background: accent }}
      />

      <div className="p-5 pt-6">
        {/* Label + icon row */}
        <div className="flex items-start justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-stone-400">
            {label}
          </p>
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
            style={{ background: `${accent}18` }}
          >
            <Icon
              className="h-3.5 w-3.5 shrink-0"
              style={{ color: accent }}
              strokeWidth={2}
              aria-hidden
            />
          </div>
        </div>

        {/* Big number */}
        <p
          className="mt-4 text-[40px] font-extrabold leading-none tracking-tight text-stone-900 tabular-nums"
          style={{ fontFamily: "var(--font-syne)" }}
        >
          {isPercent ? `${animated}%` : animated}
        </p>

        {/* Sparkline */}
        <div className="mt-4">
          <Sparkline accent={accent} seed={sparkSeed} />
        </div>

        {/* Trend */}
        <p
          className={cn(
            "mt-2.5 text-[11px] font-medium tabular-nums",
            hasTrendData ? "" : "text-stone-400"
          )}
          style={hasTrendData ? { color: accent } : undefined}
        >
          {hasTrendData ? "↑ +0% vs semaine dernière" : "— En attente de données"}
        </p>
      </div>
    </motion.div>
  );
}
