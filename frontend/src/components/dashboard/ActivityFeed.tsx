"use client";

import Link from "next/link";
import type { Application } from "@/lib/types";
import { STATUS_LABELS } from "@/lib/utils";

const ORANGE = "#F97316";

type ActivityFeedProps = {
  recentApps: Application[];
};

/** Fil d’activité — carte blanche. */
export function ActivityFeed({ recentApps }: ActivityFeedProps) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
        <h2 className="text-sm font-bold text-neutral-900">Activité récente</h2>
        <Link href="/kanban" className="text-xs font-medium text-orange-600 transition-opacity hover:opacity-80">
          Tout voir →
        </Link>
      </div>
      <ul className="divide-y divide-neutral-100">
        {recentApps.length === 0 ? (
          <>
            <li className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-neutral-50/80">
              <span className="relative mt-1.5 flex w-2 shrink-0 justify-center">
                <span className="h-2 w-2 rounded-full" style={{ background: ORANGE }} />
              </span>
              <p className="flex-1 text-[13px] leading-relaxed text-neutral-700">
                Compte créé — bienvenue sur <span className="font-medium text-orange-600">Postuly</span>.
              </p>
              <time className="shrink-0 text-[11px] text-neutral-400">maintenant</time>
            </li>
            <li className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-neutral-50/80">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-neutral-300" />
              <p className="flex-1 text-[13px] leading-relaxed text-neutral-500">
                Upload ton CV pour démarrer l’analyse ATS.
              </p>
              <span className="shrink-0 text-[11px] text-neutral-400">—</span>
            </li>
            <li className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-neutral-50/80">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-neutral-300" />
              <p className="flex-1 text-[13px] leading-relaxed text-neutral-500">
                Crée ta première campagne de candidatures.
              </p>
              <span className="shrink-0 text-[11px] text-neutral-400">—</span>
            </li>
          </>
        ) : (
          recentApps.map((app) => (
            <li
              key={app.id}
              className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-neutral-50/80"
            >
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: ORANGE }} />
              <p className="flex-1 text-[13px] leading-relaxed text-neutral-700">
                <span className="font-medium">{app.company?.name ?? "Entreprise"}</span>
                {" — "}
                {STATUS_LABELS[app.status]}
              </p>
              <time className="shrink-0 text-[11px] text-neutral-400">
                {app.sent_at
                  ? new Date(app.sent_at).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "short",
                    })
                  : "—"}
              </time>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
