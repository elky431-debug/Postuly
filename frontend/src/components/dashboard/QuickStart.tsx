"use client";

import Link from "next/link";
import { Check, ChevronRight } from "lucide-react";
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

/**
 * Bloc « Démarrage rapide » : bordure gauche orange, fond très pâle, étapes cliquables.
 */
export function QuickStart({ steps, done, doneCount }: QuickStartProps) {
  return (
    <div
      className="rounded-xl border border-stone-200 bg-[#FFFBF7] shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]"
      style={{ borderLeftWidth: 3, borderLeftColor: ORANGE }}
    >
      <div className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-stone-800">
            Démarrage rapide
          </h2>
          <span className="rounded-lg bg-white/80 px-2 py-1 text-xs font-medium tabular-nums text-stone-500 ring-1 ring-stone-200/60">
            {doneCount} / 3 étapes
          </span>
        </div>

        <div className="mb-5 h-0.5 overflow-hidden rounded-full bg-stone-200/80">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${(doneCount / 3) * 100}%`,
              backgroundColor: ORANGE,
            }}
          />
        </div>

        <ul className="flex flex-col gap-2">
          {steps.map((step, i) => (
            <li key={step.href}>
              <Link
                href={done[i] ? "#" : step.href}
                onClick={(e) => {
                  if (done[i]) e.preventDefault();
                }}
                className={cn(
                  "flex items-center gap-3 rounded-[10px] border border-stone-200/80 px-4 py-3 transition-colors duration-150",
                  !done[i] && "hover:bg-stone-50",
                  done[i] && "cursor-default bg-stone-100/40"
                )}
              >
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    done[i]
                      ? "bg-green-50 text-green-600 ring-1 ring-green-200"
                      : "bg-stone-100 text-stone-600 ring-1 ring-stone-200/80"
                  )}
                >
                  {done[i] ? (
                    <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                  ) : (
                    <span className="tabular-nums">{i + 1}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "text-sm font-semibold leading-tight text-stone-800",
                      done[i] && "text-stone-400 line-through"
                    )}
                  >
                    {step.label}
                  </p>
                  <p className="mt-0.5 truncate text-xs leading-relaxed text-stone-500">{step.desc}</p>
                </div>
                {!done[i] && (
                  <ChevronRight className="h-4 w-4 shrink-0 text-stone-300" strokeWidth={2} aria-hidden />
                )}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
