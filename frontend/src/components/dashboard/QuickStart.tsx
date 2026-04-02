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

export function QuickStart({ steps, done, doneCount }: QuickStartProps) {
  const pct = (doneCount / 3) * 100;

  return (
    <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-stone-200/70">
      {/* Header */}
      <div className="border-b border-stone-100 px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2
              className="text-[15px] font-bold text-stone-900"
              style={{ fontFamily: "var(--font-syne)" }}
            >
              Démarrage rapide
            </h2>
            <p className="mt-0.5 text-[11px] text-stone-400">
              3 étapes pour automatiser tes envois
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="text-[12px] font-bold tabular-nums text-stone-500">
              {doneCount}
              <span className="font-normal text-stone-300">/3</span>
            </span>
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-stone-100">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{ width: `${pct}%`, background: "#F97316" }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Steps */}
      <ul>
        {steps.map((step, i) => (
          <li key={step.href} className={cn(i !== 0 && "border-t border-stone-100/80")}>
            <Link
              href={done[i] ? "#" : step.href}
              onClick={(e) => done[i] && e.preventDefault()}
              className={cn(
                "group flex items-center gap-4 px-5 py-4 transition-colors",
                !done[i] && "hover:bg-stone-50/60",
                done[i] && "cursor-default"
              )}
            >
              {/* Step indicator */}
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-bold transition-all",
                  done[i]
                    ? "bg-emerald-100 text-emerald-600"
                    : "bg-orange-50 text-orange-500 ring-1 ring-orange-200/60"
                )}
              >
                {done[i] ? (
                  <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                ) : (
                  i + 1
                )}
              </div>

              {/* Text */}
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-[13px] font-semibold",
                    done[i] ? "text-stone-400 line-through decoration-stone-300" : "text-stone-800"
                  )}
                >
                  {step.label}
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-stone-400">
                  {step.desc}
                </p>
              </div>

              {/* Arrow */}
              {!done[i] && (
                <ChevronRight
                  className="h-4 w-4 shrink-0 text-stone-300 transition-all group-hover:translate-x-0.5 group-hover:text-orange-400"
                  strokeWidth={2}
                />
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
