"use client";

import { Rocket } from "lucide-react";
import type { Campaign } from "@/lib/types";
import { CONTRACT_LABELS } from "@/lib/utils";

const ORANGE = "#F97316";
const BD = "#E7E5E4";

function statusMeta(status: Campaign["status"]): { label: string; className: string } {
  switch (status) {
    case "running":
      return {
        label: "Actif",
        className: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80",
      };
    case "paused":
      return {
        label: "En pause",
        className: "bg-amber-50 text-amber-800 ring-1 ring-amber-200/80",
      };
    case "completed":
      return {
        label: "Terminé",
        className: "bg-neutral-100 text-neutral-600 ring-1 ring-neutral-200",
      };
    default:
      return {
        label: "Brouillon",
        className: "bg-neutral-50 text-neutral-600 ring-1 ring-neutral-200",
      };
  }
}

type CampaignTableProps = {
  campaigns: Campaign[];
  onRowClick?: (id: string) => void;
};

/** Tableau campagnes — fond clair. */
export function CampaignTable({ campaigns, onRowClick }: CampaignTableProps) {
  if (campaigns.length === 0) {
    return (
      <div className="py-14 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100 ring-1 ring-stone-200/80">
          <Rocket className="h-6 w-6 text-neutral-400" strokeWidth={1.75} aria-hidden />
        </div>
        <p className="text-sm font-medium text-neutral-800">Aucune campagne pour l’instant</p>
        <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-neutral-500">
          Lance ta première campagne pour cibler des entreprises et envoyer des candidatures.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="border-b" style={{ borderColor: BD }}>
            {(["Campagne", "Statut", "Envoyées", "Progression"] as const).map((h) => (
              <th
                key={h}
                className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-neutral-500"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {campaigns.map((c) => {
            const st = statusMeta(c.status);
            const progress = 0;
            return (
              <tr
                key={c.id}
                className="cursor-pointer border-b transition-colors hover:bg-neutral-50/80"
                style={{ borderColor: BD }}
                onClick={() => onRowClick?.(c.id)}
              >
                <td className="px-5 py-3.5">
                  <p className="font-medium text-neutral-900">{c.job_title}</p>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    {c.location} · {CONTRACT_LABELS[c.contract_type]}
                  </p>
                </td>
                <td className="px-5 py-3.5">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${st.className}`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                    {st.label}
                  </span>
                </td>
                <td className="px-5 py-3.5 font-medium tabular-nums text-neutral-600">—</td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${progress}%`, background: ORANGE }}
                      />
                    </div>
                    <span className="w-8 text-right tabular-nums text-neutral-400">{progress}%</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
