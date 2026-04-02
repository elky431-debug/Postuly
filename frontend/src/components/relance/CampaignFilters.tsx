"use client";

import { Search } from "lucide-react";

type CampaignFiltersProps = {
  status: "all" | "no_reply" | "replied";
  onStatusChange: (v: "all" | "no_reply" | "replied") => void;
  date: "all" | "7d" | "30d";
  onDateChange: (v: "all" | "7d" | "30d") => void;
  search: string;
  onSearchChange: (v: string) => void;
};

export function CampaignFilters({
  status,
  onStatusChange,
  date,
  onDateChange,
  search,
  onSearchChange,
}: CampaignFiltersProps) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label>
          <span className="mb-1.5 block text-xs font-medium text-stone-500">Statut</span>
          <select
            value={status}
            onChange={(e) => onStatusChange(e.target.value as CampaignFiltersProps["status"])}
            className="h-10 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-800 outline-none focus:border-orange-300"
          >
            <option value="all">Toutes</option>
            <option value="no_reply">Sans réponse</option>
            <option value="replied">Avec réponse</option>
          </select>
        </label>
        <label>
          <span className="mb-1.5 block text-xs font-medium text-stone-500">Date</span>
          <select
            value={date}
            onChange={(e) => onDateChange(e.target.value as CampaignFiltersProps["date"])}
            className="h-10 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-800 outline-none focus:border-orange-300"
          >
            <option value="all">Tout</option>
            <option value="7d">7 derniers jours</option>
            <option value="30d">30 derniers jours</option>
          </select>
        </label>
        <label>
          <span className="mb-1.5 block text-xs font-medium text-stone-500">Recherche</span>
          <div className="flex h-10 items-center gap-2 rounded-xl border border-stone-200 bg-white px-3">
            <Search className="h-4 w-4 shrink-0 text-stone-400" />
            <input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Campagne ou entreprise"
              className="min-w-0 flex-1 bg-transparent text-sm text-stone-800 outline-none placeholder:text-stone-400"
            />
          </div>
        </label>
      </div>
    </div>
  );
}
