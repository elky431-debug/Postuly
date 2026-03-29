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
    <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 shrink-0" style={{ color: ORANGE }} strokeWidth={2} aria-hidden />
        <h2 className="text-sm font-bold text-neutral-900">Actions rapides</h2>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {items.map((qa) => {
          const QIcon = qa.Icon;
          return (
            <Link
              key={qa.href + qa.label}
              href={qa.href}
              className="group rounded-[10px] border border-neutral-200 bg-white p-[14px] transition-colors hover:border-orange-200 hover:bg-orange-50/50"
            >
              <QIcon
                className="h-5 w-5 text-neutral-400 transition-colors group-hover:text-orange-500"
                strokeWidth={2}
                aria-hidden
              />
              <p className="mt-3 text-[13px] font-medium leading-snug text-neutral-800">{qa.label}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-neutral-500">{qa.sub}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
