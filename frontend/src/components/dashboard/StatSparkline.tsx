"use client";

import { motion } from "framer-motion";

const HEIGHTS_PCT = [42, 58, 48, 72, 54, 68];

type StatSparklineProps = {
  /** Couleur de la dernière barre (accent thématique) */
  accent: string;
};

/**
 * Mini sparkline : 6 barres grises, la dernière colorée — animation gauche → droite au montage.
 */
export function StatSparkline({ accent }: StatSparklineProps) {
  return (
    <div className="mt-4 flex h-6 items-end gap-0.5" aria-hidden>
      {HEIGHTS_PCT.map((pct, i) => (
        <motion.div
          key={i}
          className="flex-1 max-w-[7px] rounded-sm origin-bottom"
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{
            duration: 0.45,
            delay: i * 0.08,
            ease: "easeOut",
          }}
          style={{
            height: `${pct}%`,
            minHeight: 4,
            backgroundColor: i === HEIGHTS_PCT.length - 1 ? accent : "#E7E5E4",
          }}
        />
      ))}
    </div>
  );
}
