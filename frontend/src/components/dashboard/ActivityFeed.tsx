"use client";

import Link from "next/link";
import type { Application } from "@/lib/types";
import { STATUS_LABELS } from "@/lib/utils";

const ORANGE = "#F97316";

type ActivityFeedProps = {
  recentApps: Application[];
};

/**
 * Fil d’activité type timeline : point orange (récent) ou gris (attente).
 */
export function ActivityFeed({ recentApps }: ActivityFeedProps) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-stone-800">Activité récente</h2>
        <Link
          href="/kanban"
          className="text-xs font-medium text-[#F97316] transition-opacity hover:opacity-80"
        >
          Tout voir →
        </Link>
      </div>
      <ul className="divide-y divide-stone-200">
        {recentApps.length === 0 ? (
          <>
            <li className="flex items-start gap-3 px-5 py-3.5">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: ORANGE }} />
              <p className="flex-1 text-sm leading-relaxed text-[#1C1917]">
                Compte créé — bienvenue sur <span className="font-semibold text-[#F97316]">Postuly</span>.
              </p>
              <time className="shrink-0 text-xs text-stone-400">maintenant</time>
            </li>
            <li className="flex items-start gap-3 px-5 py-3.5">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-stone-300" />
              <p className="flex-1 text-sm leading-relaxed text-stone-500">
                Envoie ton CV pour démarrer l’analyse ATS.
              </p>
              <span className="shrink-0 text-xs text-stone-400">—</span>
            </li>
            <li className="flex items-start gap-3 px-5 py-3.5">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-stone-300" />
              <p className="flex-1 text-sm leading-relaxed text-stone-500">
                Crée ta première campagne de candidatures.
              </p>
              <span className="shrink-0 text-xs text-stone-400">—</span>
            </li>
          </>
        ) : (
          recentApps.map((app) => (
            <li key={app.id} className="flex items-start gap-3 px-5 py-3.5">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: ORANGE }} />
              <p className="flex-1 text-sm leading-relaxed text-[#1C1917]">
                <span className="font-medium">{app.company?.name ?? "Entreprise"}</span>
                {" — "}
                {STATUS_LABELS[app.status]}
              </p>
              <time className="shrink-0 text-xs text-stone-400">
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
