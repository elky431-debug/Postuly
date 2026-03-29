"use client";

import { useEffect, useState } from "react";

/**
 * Anime un entier de 0 à `target` (ease-out cubique), durée par défaut 800 ms.
 */
export function useCountUp(target: number, durationMs = 800, resetKey = 0): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    setValue(0);
    const start = performance.now();
    let raf = 0;

    function tick(now: number) {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - t) ** 3;
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs, resetKey]);

  return value;
}
