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

/** Grille 2×2 — fond blanc. */
export function QuickActions({ items }: QuickActionsProps) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-[0_14px_30px_-28px_rgba(15,23,42,0.6)]">
      <div className="mb-4 flex items-center gap-2.5">
        <Sparkles className="h-4 w-4 shrink-0 text-orange-500" strokeWidth={2} aria-hidden />
        <div>
          <h2 className="text-sm font-semibold text-stone-900">Actions rapides</h2>
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
              className="group rounded-xl border border-stone-200 bg-stone-50/70 p-3.5 transition-all hover:border-orange-200 hover:bg-orange-50/40"
            >
              <QIcon
                className="h-4 w-4 text-stone-400 transition-colors group-hover:text-orange-500"
                strokeWidth={2}
                aria-hidden
              />
              <p className="mt-2.5 text-[13px] font-medium leading-snug text-stone-800">{qa.label}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-stone-500">{qa.sub}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
