"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Sparkles } from "lucide-react";

export type QuickActionItem = {
  Icon: LucideIcon;
  label: string;
  sub: string;
  href: string;
};

type QuickActionsProps = {
  items: QuickActionItem[];
};

const ORANGE = "#F97316";

/** Grille 2×2 — fond blanc. */
export function QuickActions({ items }: QuickActionsProps) {
  return (
    <div className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
      <div className="mb-5 flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50 ring-1 ring-orange-100">
          <Sparkles className="h-3.5 w-3.5 shrink-0" style={{ color: ORANGE }} strokeWidth={2} aria-hidden />
        </span>
        <div>
          <h2 className="text-sm font-bold text-stone-900">Actions rapides</h2>
          <p className="text-[11px] text-stone-500">Raccourcis vers les outils clés</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {items.map((qa) => {
          const QIcon = qa.Icon;
          return (
            <Link
              key={qa.href + qa.label}
              href={qa.href}
              className="group rounded-xl border border-stone-200/80 bg-stone-50/40 p-3.5 transition-all duration-200 hover:border-orange-200/90 hover:bg-gradient-to-br hover:from-orange-50/90 hover:to-white hover:shadow-md hover:shadow-orange-500/5"
            >
              <QIcon
                className="h-5 w-5 text-stone-400 transition-colors group-hover:text-orange-500"
                strokeWidth={2}
                aria-hidden
              />
              <p className="mt-3 text-[13px] font-semibold leading-snug text-stone-800">{qa.label}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-stone-500">{qa.sub}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
