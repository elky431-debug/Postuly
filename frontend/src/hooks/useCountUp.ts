"use client";

import { useEffect, useState } from "react";

/** Courbe ease-out proche de cubic-bezier(0.25, 0.46, 0.45, 0.94) */
function easeOutQuart(t: number): number {
  return 1 - (1 - t) ** 4;
}

/**
 * Anime un entier de 0 à `target` (ease-out), durée par défaut 1200 ms.
 */
export function useCountUp(target: number, durationMs = 1200, resetKey = 0): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    setValue(0);
    const start = performance.now();
    let raf = 0;

    function tick(now: number) {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = easeOutQuart(t);
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs, resetKey]);

  return value;
}
