"use client";

import Link from "next/link";
import { Check, ChevronRight, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export type QuickStartStep = {
  label: string;
  desc: string;
  href: string;
};

type QuickStartProps = {
  steps: QuickStartStep[];
  done: boolean[];
  doneCount: number;
};

const ORANGE = "#F97316";

/** Bloc « Démarrage rapide » — carte blanche. */
export function QuickStart({ steps, done, doneCount }: QuickStartProps) {
  const pct = (doneCount / 3) * 100;

  return (
    <div className="overflow-hidden rounded-2xl border border-stone-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
      <div className="border-b border-stone-100 bg-gradient-to-br from-orange-50/80 via-white to-stone-50/30 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-orange-100">
              <Zap className="h-4 w-4 shrink-0" style={{ color: ORANGE }} strokeWidth={2} aria-hidden />
            </span>
            <div>
              <h2 className="text-sm font-bold text-stone-900">Démarrage rapide</h2>
              <p className="text-[11px] text-stone-500">Les 3 étapes pour automatiser tes envois</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium tabular-nums text-stone-600">{doneCount} / 3</span>
            <div className="h-2 w-28 overflow-hidden rounded-full bg-stone-200/80">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out shadow-[0_0_12px_rgba(249,115,22,0.35)]"
                style={{ width: `${pct}%`, backgroundColor: ORANGE }}
              />
            </div>
          </div>
        </div>
      </div>

      <ul className="divide-y divide-stone-100">
        {steps.map((step, i) => (
          <li key={step.href}>
            <Link
              href={done[i] ? "#" : step.href}
              onClick={(e) => done[i] && e.preventDefault()}
              className={cn(
                "group flex items-center gap-3 px-4 py-3.5 transition-colors",
                !done[i] && "hover:bg-stone-50/80",
                done[i] && "cursor-default opacity-90"
              )}
            >
              <div
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold",
                  done[i]
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-neutral-100 text-neutral-500"
                )}
              >
                {done[i] ? <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden /> : i + 1}
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-sm font-medium text-stone-800",
                    done[i] && "text-stone-400 line-through"
                  )}
                >
                  {step.label}
                </p>
                <p className="mt-0.5 text-xs text-stone-500">{step.desc}</p>
              </div>
              {!done[i] && (
                <ChevronRight
                  className="h-3.5 w-3.5 shrink-0 text-neutral-300 transition-transform group-hover:translate-x-0.5 group-hover:text-orange-500"
                  strokeWidth={2}
                  aria-hidden
                />
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
