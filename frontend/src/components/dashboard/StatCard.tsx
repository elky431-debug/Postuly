"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { useCountUp } from "@/hooks/useCountUp";
import { cn } from "@/lib/utils";
import { Sparkline } from "./Sparkline";

type StatCardProps = {
  label: string;
  countTarget: number;
  isPercent?: boolean;
  accent: string;
  Icon: LucideIcon;
  sparkSeed: string;
  hasTrendData?: boolean;
};

/**
 * Carte KPI — fond blanc, bordure légère, CountUp.
 */
export function StatCard({
  label,
  countTarget,
  isPercent,
  accent,
  Icon,
  sparkSeed,
  hasTrendData = false,
}: StatCardProps) {
  const animated = useCountUp(countTarget, 1200);

  return (
    <motion.div
      initial={false}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="group rounded-xl border border-neutral-200 bg-white p-5 shadow-sm transition-colors hover:border-neutral-300"
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: `${accent}18` }}
        >
          <Icon className="h-[18px] w-[18px]" style={{ color: accent }} strokeWidth={2} aria-hidden />
        </div>
        <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
          Début
        </span>
      </div>

      <p
        className="mt-4 text-[40px] font-extrabold leading-none tracking-tight text-neutral-900 tabular-nums"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {isPercent ? `${animated}%` : animated}
      </p>
      <p className="mt-1 text-[13px] text-neutral-500">{label}</p>

      <div className="mt-4">
        <Sparkline accent={accent} seed={sparkSeed} />
      </div>

      <p
        className={cn("mt-2 text-[11px] tabular-nums", !hasTrendData && "text-neutral-400")}
        style={hasTrendData ? { color: accent } : undefined}
      >
        {hasTrendData ? "↑ +0% vs semaine dernière" : "— En attente de données"}
      </p>
    </motion.div>
  );
}
