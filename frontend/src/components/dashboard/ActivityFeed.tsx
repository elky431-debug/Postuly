"use client";

import Link from "next/link";
import type { Application } from "@/lib/types";
import { STATUS_LABELS } from "@/lib/utils";

type ActivityFeedProps = {
  recentApps: Application[];
};

const STATUS_COLORS: Record<string, string> = {
  sent: "#F97316",
  replied: "#22C55E",
  interview: "#3B82F6",
  offer: "#8B5CF6",
  rejected: "#EF4444",
};

export function ActivityFeed({ recentApps }: ActivityFeedProps) {
  return (
    <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-stone-200/70">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
        <h2
          className="text-[14px] font-bold text-stone-900"
          style={{ fontFamily: "var(--font-syne)" }}
        >
          Activité récente
        </h2>
        <Link
          href="/kanban"
          className="text-[12px] font-semibold text-orange-500 transition-colors hover:text-orange-600"
        >
          Tout voir →
        </Link>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[28px] top-0 h-full w-px bg-stone-100" />

        <ul className="py-2">
          {recentApps.length === 0 ? (
            <>
              {[
                {
                  dot: "#F97316",
                  text: (
                    <>
                      Compte créé — bienvenue sur{" "}
                      <span className="font-semibold text-orange-500">Postuly</span>
                    </>
                  ),
                  time: "maintenant",
                },
                {
                  dot: "#D1D5DB",
                  text: "Upload ton CV pour démarrer l'analyse ATS.",
                  time: "—",
                },
                {
                  dot: "#D1D5DB",
                  text: "Ajoute des entreprises et lance tes candidatures.",
                  time: "—",
                },
              ].map((entry, i) => (
                <li key={i} className="flex items-start gap-4 px-5 py-3">
                  <div className="relative z-10 mt-[3px] flex h-5 w-5 shrink-0 items-center justify-center">
                    <div
                      className="h-2 w-2 rounded-full"
                      style={{ background: entry.dot }}
                    />
                  </div>
                  <p className="flex-1 text-[13px] leading-relaxed text-stone-600">
                    {entry.text}
                  </p>
                  <time className="shrink-0 pt-[1px] text-[11px] tabular-nums text-stone-400">
                    {entry.time}
                  </time>
                </li>
              ))}
            </>
          ) : (
            recentApps.map((app) => {
              const dot = STATUS_COLORS[app.status] ?? "#D1D5DB";
              return (
                <li key={app.id} className="flex items-start gap-4 px-5 py-3 transition-colors hover:bg-stone-50/60">
                  <div className="relative z-10 mt-[3px] flex h-5 w-5 shrink-0 items-center justify-center">
                    <div className="h-2 w-2 rounded-full" style={{ background: dot }} />
                  </div>
                  <p className="flex-1 text-[13px] leading-relaxed text-stone-700">
                    <span className="font-semibold">{app.company?.name ?? "Entreprise"}</span>
                    <span className="mx-1 text-stone-400">·</span>
                    <span className="text-stone-500">{STATUS_LABELS[app.status]}</span>
                  </p>
                  <time className="shrink-0 pt-[1px] text-[11px] tabular-nums text-stone-400">
                    {app.sent_at
                      ? new Date(app.sent_at).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "short",
                        })
                      : "—"}
                  </time>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}
