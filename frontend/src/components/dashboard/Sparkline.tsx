"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";

const BAR_COUNT = 7;

function heightsFromSeed(seed: string): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const out: number[] = [];
  for (let i = 0; i < BAR_COUNT; i++) {
    h = (h * 1103515245 + 12345) >>> 0;
    out.push(0.35 + (h % 65) / 100);
  }
  return out;
}

type SparklineProps = {
  accent: string;
  seed?: string;
};

/**
 * Sparkline 7 barres — barres neutres claires, dernière en accent.
 */
export function Sparkline({ accent, seed = "postuly" }: SparklineProps) {
  const heights = useMemo(() => heightsFromSeed(seed), [seed]);

  return (
    <div className="flex h-8 w-full items-end gap-0.5" aria-hidden>
      {heights.map((pct, i) => (
        <motion.div
          key={i}
          className="min-h-[3px] flex-1 max-w-[14px] rounded-[2px] origin-bottom"
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{
            duration: 0.45,
            delay: i * 0.05,
            ease: [0.25, 0.46, 0.45, 0.94],
          }}
          style={{
            height: `${pct * 100}%`,
            backgroundColor: i === BAR_COUNT - 1 ? accent : "#E5E7EB",
          }}
        />
      ))}
    </div>
  );
}
