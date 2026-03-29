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
    <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 shrink-0" style={{ color: ORANGE }} strokeWidth={2} aria-hidden />
          <h2 className="text-sm font-bold text-neutral-900">Démarrage rapide</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs tabular-nums text-neutral-500">{doneCount} / 3 étapes</span>
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-neutral-100">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{ width: `${pct}%`, backgroundColor: ORANGE }}
            />
          </div>
        </div>
      </div>

      <ul className="divide-y divide-neutral-100">
        {steps.map((step, i) => (
          <li key={step.href}>
            <Link
              href={done[i] ? "#" : step.href}
              onClick={(e) => done[i] && e.preventDefault()}
              className={cn(
                "group -mx-1 flex items-center gap-3 rounded-lg px-4 py-3 transition-colors",
                !done[i] && "hover:bg-neutral-50",
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
                    "text-sm font-medium text-neutral-800",
                    done[i] && "text-neutral-400 line-through"
                  )}
                >
                  {step.label}
                </p>
                <p className="mt-0.5 text-xs text-neutral-500">{step.desc}</p>
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
