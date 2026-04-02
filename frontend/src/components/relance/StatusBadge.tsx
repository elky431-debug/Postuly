"use client";

import { cn } from "@/lib/utils";
import type { RelanceApplicationUiStatus, RelanceCampaignUiStatus } from "@/types/relance";

type AppStatus = RelanceApplicationUiStatus;
type CampStatus = RelanceCampaignUiStatus;

const APP_LABELS: Record<AppStatus, string> = {
  no_reply: "Pas de réponse",
  replied: "Répondu",
  relanced: "Relancé",
};

const CAMP_LABELS: Record<CampStatus, string> = {
  no_reply: "Sans réponse",
  partial: "Partielle",
  completed: "Terminée",
};

const APP_STYLES: Record<AppStatus, string> = {
  no_reply: "bg-red-50 text-red-700 ring-1 ring-red-200",
  replied: "bg-green-50 text-green-700 ring-1 ring-green-200",
  relanced: "bg-yellow-50 text-yellow-800 ring-1 ring-yellow-200",
};

const CAMP_STYLES: Record<CampStatus, string> = {
  no_reply: "bg-red-50 text-red-700 ring-1 ring-red-200",
  partial: "bg-amber-50 text-amber-900 ring-1 ring-amber-200",
  completed: "bg-stone-100 text-stone-700 ring-1 ring-stone-200",
};

type StatusBadgeProps =
  | { scope: "application"; status: AppStatus; className?: string }
  | { scope: "campaign"; status: CampStatus; className?: string };

export function StatusBadge(props: StatusBadgeProps) {
  if (props.scope === "application") {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
          APP_STYLES[props.status],
          props.className
        )}
      >
        {APP_LABELS[props.status]}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        CAMP_STYLES[props.status],
        props.className
      )}
    >
      {CAMP_LABELS[props.status]}
    </span>
  );
}
