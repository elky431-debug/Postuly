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
    <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-[0_14px_30px_-28px_rgba(15,23,42,0.6)]">
      <div className="border-b border-stone-100 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50 ring-1 ring-orange-100">
              <Zap className="h-4 w-4 shrink-0 text-orange-500" strokeWidth={2} aria-hidden />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-stone-900">Démarrage rapide</h2>
              <p className="text-[11px] text-stone-500">Les 3 étapes pour automatiser tes envois</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium tabular-nums text-stone-500">{doneCount} / 3</span>
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-stone-100">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
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
                "group flex items-center gap-3 px-5 py-3.5 transition-colors",
                !done[i] && "hover:bg-stone-50/60",
                done[i] && "cursor-default"
              )}
            >
              <div
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold",
                  done[i]
                    ? "bg-emerald-50 text-emerald-600"
                    : "bg-stone-100 text-stone-500"
                )}
              >
                {done[i] ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden /> : i + 1}
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-[13px] font-medium text-stone-800",
                    done[i] && "text-stone-400 line-through"
                  )}
                >
                  {step.label}
                </p>
                <p className="mt-0.5 text-[11px] text-stone-500">{step.desc}</p>
              </div>
              {!done[i] && (
                <ChevronRight
                  className="h-3.5 w-3.5 shrink-0 text-stone-300 transition-colors group-hover:text-orange-500"
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
