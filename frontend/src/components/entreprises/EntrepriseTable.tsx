"use client";

import type { EntrepriseSearchResult } from "@/types/entreprise";
import { EntrepriseRow } from "./EntrepriseRow";

type EntrepriseTableProps = {
  rows: EntrepriseSearchResult[];
  /** Sirets cochés dans le tableau (sélection courante pour lot). */
  checkedSirets: Set<string>;
  onToggleRow: (siret: string) => void;
  onToggleAll: (checked: boolean) => void;
  isInStore: (siret: string) => boolean;
  onAdd: (row: EntrepriseSearchResult) => void;
  onVoir: (row: EntrepriseSearchResult) => void;
};

/** Tableau résultats avec en-têtes. */
export function EntrepriseTable({
  rows,
  checkedSirets,
  onToggleRow,
  onToggleAll,
  isInStore,
  onAdd,
  onVoir,
}: EntrepriseTableProps) {
  const allChecked = rows.length > 0 && rows.every((r) => checkedSirets.has(r.siret));

  return (
    <div className="overflow-x-auto rounded-xl border border-[#2A2A2A]">
      <table className="w-full min-w-[900px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-[#1F1F1F] bg-[#141414]">
            <th className="px-3 py-3">
              <input
                type="checkbox"
                checked={allChecked}
                onChange={(e) => onToggleAll(e.target.checked)}
                className="h-4 w-4 rounded border-[#2A2A2A] bg-[#141414] text-[#F97316]"
                aria-label="Tout sélectionner"
              />
            </th>
            <th className="px-3 py-3 text-[10px] font-semibold uppercase tracking-wider text-[#525252]">
              Entreprise
            </th>
            <th className="px-3 py-3 text-[10px] font-semibold uppercase tracking-wider text-[#525252]">
              Score
            </th>
            <th className="px-3 py-3 text-[10px] font-semibold uppercase tracking-wider text-[#525252]">
              Localisation
            </th>
            <th className="px-3 py-3 text-[10px] font-semibold uppercase tracking-wider text-[#525252]">
              Domaine
            </th>
            <th className="px-3 py-3 text-center text-[10px] font-semibold uppercase tracking-wider text-[#525252]">
              Tranche eff.
            </th>
            <th className="px-3 py-3 text-[10px] font-semibold uppercase tracking-wider text-[#525252]">
              Taille
            </th>
            <th className="px-3 py-3 text-[10px] font-semibold uppercase tracking-wider text-[#525252]">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <EntrepriseRow
              key={row.siret}
              row={row}
              selected={checkedSirets.has(row.siret)}
              inSelection={isInStore(row.siret)}
              onToggleRow={onToggleRow}
              onAdd={onAdd}
              onVoir={onVoir}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
