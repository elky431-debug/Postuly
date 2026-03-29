"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export type QuickActionItem = {
  Icon: LucideIcon;
  label: string;
  sub: string;
  href: string;
};

type QuickActionsGridProps = {
  title?: string;
  items: QuickActionItem[];
};

/**
 * Grille 2×2 d’actions rapides : hover stone-50, icône passe en orange.
 */
export function QuickActionsGrid({ title = "Actions rapides", items }: QuickActionsGridProps) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="border-b border-stone-200 px-5 py-4">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-stone-800">{title}</h2>
      </div>
      <div className="grid grid-cols-2 gap-2 p-4">
        {items.map((qa) => {
          const QIcon = qa.Icon;
          return (
            <Link
              key={qa.href + qa.label}
              href={qa.href}
              className="group rounded-[10px] border border-stone-200 p-4 transition-colors duration-150 hover:bg-stone-50"
            >
              <QIcon
                className="h-[18px] w-[18px] text-stone-400 transition-colors duration-150 group-hover:text-[#F97316]"
                strokeWidth={2}
                aria-hidden
              />
              <p className="mt-3 text-sm font-bold leading-snug text-stone-800">{qa.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-stone-500">{qa.sub}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
