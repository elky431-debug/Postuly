"use client";

import { cn } from "@/lib/utils";

type ScoreBadgeProps = {
  score: number;
};

/** Badge de score (vert / ambre / rouge). */
export function ScoreBadge({ score }: ScoreBadgeProps) {
  const tier =
    score >= 80 ? "high" : score >= 60 ? "mid" : "low";
  return (
    <span
      className={cn(
        "inline-flex min-w-[2.75rem] justify-center rounded-md px-2 py-0.5 text-xs font-bold tabular-nums",
        tier === "high" && "bg-[#22C55E]/20 text-[#22C55E]",
        tier === "mid" && "bg-[#F59E0B]/20 text-[#F59E0B]",
        tier === "low" && "bg-[#EF4444]/20 text-[#EF4444]"
      )}
    >
      {score}
    </span>
  );
}
