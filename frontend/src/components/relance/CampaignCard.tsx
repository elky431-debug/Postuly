"use client";

import Link from "next/link";
import type { RelanceCampaignSummary } from "@/types/relance";
import { StatusBadge } from "./StatusBadge";

type CampaignCardProps = {
  campaign: RelanceCampaignSummary;
  selected: boolean;
  onToggleSelect: (campaignId: string) => void;
  onRelancerToutes: (id: string) => void;
  busy?: boolean;
};

export function CampaignCard({
  campaign,
  selected,
  onToggleSelect,
  onRelancerToutes,
  busy,
}: CampaignCardProps) {
  const canBulk = campaign.sentCount > 0;
  const canSelect = canBulk;

  return (
    <div
      className={`flex flex-col rounded-2xl border bg-white p-5 shadow-[0_14px_30px_-28px_rgba(15,23,42,0.6)] ${
        selected ? "border-orange-300 ring-2 ring-orange-100" : "border-stone-200"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={selected}
            disabled={!canSelect || busy}
            onChange={() => onToggleSelect(campaign.id)}
            className="mt-1 h-4 w-4 shrink-0 rounded border-stone-300 text-orange-500 focus:ring-orange-500 disabled:opacity-40"
            aria-label={`Sélectionner la campagne ${campaign.title}`}
          />
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-stone-900">{campaign.title}</h2>
            <p className="mt-1 text-xs text-stone-500">
              {campaign.jobTitle} · {campaign.location} · {campaign.contractType.toUpperCase()}
            </p>
            {!canSelect && (
              <p className="mt-1 text-[11px] text-stone-400">Aucune candidature « Envoyé » à relancer</p>
            )}
          </div>
        </label>
        <StatusBadge scope="campaign" status={campaign.uiStatus} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2 text-xs text-stone-600 sm:grid-cols-4">
        <div>
          <dt className="text-stone-400">Créée</dt>
          <dd className="font-medium text-stone-800">
            {new Date(campaign.createdAt).toLocaleDateString("fr-FR")}
          </dd>
        </div>
        <div>
          <dt className="text-stone-400">Dernier envoi</dt>
          <dd className="font-medium text-stone-800">
            {campaign.lastSentAt
              ? new Date(campaign.lastSentAt).toLocaleDateString("fr-FR")
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-stone-400">Candidatures</dt>
          <dd className="font-medium text-stone-800">{campaign.totalApplications}</dd>
        </div>
        <div>
          <dt className="text-stone-400">Réponses / relances</dt>
          <dd className="font-medium text-stone-800">
            {campaign.repliedCount} / {campaign.followedUpCount}
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/relance/${campaign.id}`}
          className="inline-flex flex-1 items-center justify-center rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50 sm:flex-none"
        >
          Voir les candidatures
        </Link>
        <button
          type="button"
          disabled={!canBulk || busy}
          onClick={() => onRelancerToutes(campaign.id)}
          className="inline-flex flex-1 items-center justify-center rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
        >
          Relancer toutes
        </button>
      </div>
    </div>
  );
}
