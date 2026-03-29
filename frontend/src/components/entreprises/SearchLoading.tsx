"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

type SearchLoadingProps = {
  active: boolean;
};

/** Animation de chargement type Jobea : timer + textes. */
export function SearchLoading({ active }: SearchLoadingProps) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!active) {
      setSeconds(0);
      return;
    }
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [active]);

  if (!active) return null;

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-16">
      <div className="relative flex h-24 w-24 items-center justify-center">
        <div
          className="absolute inset-0 rounded-full border-2 border-[#2A2A2A]"
          aria-hidden
        />
        <div
          className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-[#F97316]"
          style={{ animationDuration: "1.2s" }}
          aria-hidden
        />
        <span className="text-2xl font-bold tabular-nums text-[#F5F5F5]" style={{ fontVariantNumeric: "tabular-nums" }}>
          {seconds}s
        </span>
      </div>
      <div className="max-w-md text-center">
        <p className="text-lg font-semibold text-[#F5F5F5]">On trouve vos entreprises…</p>
        <p className="mt-2 text-sm leading-relaxed text-[#A3A3A3]">
          Nous analysons des milliers d’entreprises pour vous proposer les plus pertinentes.
        </p>
      </div>
      <div className="flex items-center gap-2 text-sm text-[#A3A3A3]">
        <Loader2 className="h-4 w-4 animate-spin text-[#F97316]" aria-hidden />
        Analyse en cours…
      </div>
    </div>
  );
}
