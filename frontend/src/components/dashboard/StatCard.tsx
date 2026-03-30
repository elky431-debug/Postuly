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
      className="group rounded-2xl border border-stone-200/90 bg-white p-6 shadow-[0_1px_3px_rgba(15,23,42,0.06)] transition-all duration-300 hover:border-stone-300/90 hover:shadow-[0_12px_40px_-12px_rgba(15,23,42,0.12)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-black/[0.04]"
          style={{ backgroundColor: `${accent}14` }}
        >
          <Icon className="h-[19px] w-[19px]" style={{ color: accent }} strokeWidth={2} aria-hidden />
        </div>
        <span className="rounded-full bg-stone-100/90 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-stone-500">
          Aperçu
        </span>
      </div>

      <p
        className="mt-5 text-[42px] font-extrabold leading-none tracking-tight text-stone-900 tabular-nums"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {isPercent ? `${animated}%` : animated}
      </p>
      <p className="mt-1.5 text-[13px] font-medium text-stone-500">{label}</p>

      <div className="mt-4">
        <Sparkline accent={accent} seed={sparkSeed} />
      </div>

      <p
        className={cn("mt-2 text-[11px] tabular-nums", !hasTrendData && "text-stone-400")}
        style={hasTrendData ? { color: accent } : undefined}
      >
        {hasTrendData ? "↑ +0% vs semaine dernière" : "— En attente de données"}
      </p>
    </motion.div>
  );
}
