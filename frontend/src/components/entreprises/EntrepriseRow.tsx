"use client";

import { Eye } from "lucide-react";
import type { EntrepriseSearchResult } from "@/types/entreprise";
import { ScoreBadge } from "./ScoreBadge";
import { TaillePill } from "./TaillePill";
import { CompanyLogo } from "@/components/ui/CompanyLogo";
import { cn } from "@/lib/utils";

const DOMAINE_MAX = 28;

type EntrepriseRowProps = {
  row: EntrepriseSearchResult;
  selected: boolean;
  inSelection: boolean;
  onToggleRow: (siret: string) => void;
  onAdd: (row: EntrepriseSearchResult) => void;
  onVoir: (row: EntrepriseSearchResult) => void;
};

/** Une ligne du tableau entreprises. */
export function EntrepriseRow({
  row,
  selected,
  inSelection,
  onToggleRow,
  onAdd,
  onVoir,
}: EntrepriseRowProps) {
  const domaine = row.libelleNaf || row.domaine || row.naf;
  const employes = row.effectifLabel && row.effectifLabel !== "Non renseigné" ? row.effectifLabel : "—";
  const domaineIsTruncated = domaine.length > DOMAINE_MAX;
  const domaineShort = domaineIsTruncated ? domaine.slice(0, DOMAINE_MAX) + "…" : domaine;

  return (
    <tr
      className={cn(
        "border-b border-neutral-100 transition-colors hover:bg-neutral-50",
        selected && "bg-orange-50/50"
      )}
    >
      <td className="px-3 py-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleRow(row.siret)}
          className="h-4 w-4 rounded border-neutral-300 bg-white text-[#F97316] focus:ring-[#F97316]/30"
          aria-label={`Sélectionner ${row.nom}`}
        />
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-2.5">
          <CompanyLogo name={row.nom} size="sm" />
          <p className="font-semibold text-neutral-900">{row.nom}</p>
        </div>
      </td>
      <td className="px-3 py-3">
        <ScoreBadge score={row.score} />
      </td>
      <td className="px-3 py-3 text-sm text-neutral-600">
        {row.codePostal} {row.ville}
      </td>
      <td className="px-3 py-3 text-sm text-neutral-600">
        <span>{domaineShort}</span>
        {domaineIsTruncated && (
          <button
            type="button"
            onClick={() => onVoir(row)}
            className="ml-1 text-[11px] text-[#F97316] hover:underline"
          >
            voir +
          </button>
        )}
      </td>
      <td className="px-3 py-3 text-center text-xs tabular-nums text-neutral-500">{employes}</td>
      <td className="px-3 py-3">
        <TaillePill label={row.taille} />
      </td>
      <td className="px-3 py-3">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            disabled={inSelection}
            onClick={() => onAdd(row)}
            className="rounded-lg bg-[#F97316] px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-[#EA6C0A] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {inSelection ? "Ajouté" : "Ajouter"}
          </button>
          <button
            type="button"
            onClick={() => onVoir(row)}
            className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-800 transition hover:bg-neutral-50"
          >
            <Eye className="h-3.5 w-3.5" aria-hidden />
            Voir
          </button>
        </div>
      </td>
    </tr>
  );
}
