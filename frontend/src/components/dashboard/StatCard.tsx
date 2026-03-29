"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { useCountUp } from "@/hooks/useCountUp";
import { StatSparkline } from "./StatSparkline";

type StatCardProps = {
  label: string;
  /** Valeur numérique pour l’animation CountUp */
  countTarget: number;
  /** Si true, affiche le nombre animé suivi de « % » */
  isPercent?: boolean;
  accent: string;
  iconTint: string;
  iconBg: string;
  Icon: LucideIcon;
  badge?: string;
};

const cardShadow =
  "shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]";
const cardShadowHover =
  "hover:shadow-[0_4px_12px_rgba(0,0,0,0.08),0_2px_4px_rgba(0,0,0,0.04)]";

/**
 * Carte KPI dashboard : bordure haute colorée, CountUp, sparkline, hover élévation légère.
 */
export function StatCard({
  label,
  countTarget,
  isPercent,
  accent,
  iconTint,
  iconBg,
  Icon,
  badge = "DÉBUT",
}: StatCardProps) {
  const animated = useCountUp(countTarget, 800);

  return (
    <motion.div
      initial={false}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={`rounded-xl border border-stone-200 bg-white ${cardShadow} ${cardShadowHover} transition-shadow duration-200`}
      style={{ borderTopWidth: 3, borderTopColor: accent }}
    >
      <div className="p-5 pt-4">
        <div className="flex w-full justify-end">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-stone-500">
              {badge}
            </span>
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: iconBg }}
            >
              <Icon className="h-5 w-5" style={{ color: iconTint }} strokeWidth={2} aria-hidden />
            </div>
          </div>
        </div>

        <p
          className="mt-3 text-[36px] font-bold leading-none tracking-tight text-[#1C1917] tabular-nums"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {isPercent ? `${animated}%` : animated}
        </p>
        <p className="mt-1 text-[13px] text-[#78716C]">{label}</p>

        <StatSparkline accent={accent} />
      </div>
    </motion.div>
  );
}
