"use client";

import { useCallback, useMemo, useState } from "react";
import { X } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ActivityFilters } from "@/components/entreprises/ActivityFilters";
import { FilterChips, type TailleCode } from "@/components/entreprises/FilterChips";
import { EntrepriseTable } from "@/components/entreprises/EntrepriseTable";
import { SearchBar } from "@/components/entreprises/SearchBar";
import { SearchLoading } from "@/components/entreprises/SearchLoading";
import { SelectionBar } from "@/components/entreprises/SelectionBar";
import { SwipeMode } from "@/components/entreprises/SwipeMode";
import { useSelectionStore, type EntrepriseSelection } from "@/store/selectionStore";
import type { EntrepriseSearchResponse, EntrepriseSearchResult } from "@/types/entreprise";
import { cn } from "@/lib/utils";

function activityKey(e: EntrepriseSearchResult): string {
  return e.libelleNaf ? `${e.naf}|${e.libelleNaf}` : e.naf;
}

function activityLabel(e: EntrepriseSearchResult): string {
  return e.libelleNaf || e.naf || "—";
}

function tailleKey(e: EntrepriseSearchResult): string {
  const t = e.taille;
  if (t.includes("Grande")) return "Grande entreprise";
  if (t.includes("PME")) return "PME";
  if (t.includes("Micro")) return "Micro-entreprise";
  return "Non renseigné";
}

function toSelection(e: EntrepriseSearchResult): EntrepriseSelection {
  return {
    siret: e.siret,
    nom: e.nom,
    ville: e.ville,
    codePostal: e.codePostal,
    naf: e.naf,
    libelleNaf: e.libelleNaf,
    taille: e.taille,
    trancheEffectifs: e.trancheEffectifs,
    score: e.score,
    domaine: e.domaine,
    dateCreation: e.dateCreation,
  };
}

const TAILLE_FILTER_OPTIONS: { key: string; label: string }[] = [
  { key: "Micro-entreprise", label: "Micro-entreprise" },
  { key: "PME", label: "Petite et moyenne entreprise" },
  { key: "Grande entreprise", label: "Grande entreprise" },
  { key: "Non renseigné", label: "Non renseigné" },
];

/**
 * Recherche et sélection d’entreprises pour candidatures spontanées (proxy INSEE).
 */
export default function EntreprisesPage() {
  const [secteur, setSecteur] = useState("développeur web");
  const [ville, setVille] = useState("");
  const [rayonKm, setRayonKm] = useState(35);
  const [tailleSet, setTailleSet] = useState<Set<TailleCode>>(
    () => new Set(["tpe", "pme", "grande"])
  );
  const [anciennete, setAnciennete] = useState<"recent" | "old">("recent");

  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [rawRows, setRawRows] = useState<EntrepriseSearchResult[]>([]);

  const [checkedSirets, setCheckedSirets] = useState<Set<string>>(() => new Set());
  const [excludedActivityKeys, setExcludedActivityKeys] = useState<Set<string>>(() => new Set());
  const [excludedTailleKeys, setExcludedTailleKeys] = useState<Set<string>>(() => new Set());
  const [viewMode, setViewMode] = useState<"list" | "swipe">("list");
  const [detail, setDetail] = useState<EntrepriseSearchResult | null>(null);
  const [detailWebsite, setDetailWebsite] = useState<string | null | "loading">(null);
  const [selectionOpen, setSelectionOpen] = useState(false);

  const selection = useSelectionStore((s) => s.selection);
  const ajouterEntreprise = useSelectionStore((s) => s.ajouterEntreprise);
  const retirerEntreprise = useSelectionStore((s) => s.retirerEntreprise);
  const isSelectedStore = useSelectionStore((s) => s.isSelected);

  const step = useMemo(() => {
    if (selection.length > 0 && rawRows.length > 0) return 3;
    if (rawRows.length > 0) return 2;
    return 1;
  }, [selection.length, rawRows.length]);

  const activities = useMemo(() => {
    const map = new Map<string, string>();
    rawRows.forEach((r) => {
      const k = activityKey(r);
      if (!map.has(k)) map.set(k, activityLabel(r));
    });
    return [...map.entries()].map(([key, label]) => ({ key, label }));
  }, [rawRows]);

  const filteredRows = useMemo(() => {
    let list = [...rawRows];
    if (excludedActivityKeys.size > 0) {
      list = list.filter((r) => !excludedActivityKeys.has(activityKey(r)));
    }
    if (excludedTailleKeys.size > 0) {
      list = list.filter((r) => !excludedTailleKeys.has(tailleKey(r)));
    }
    const hasDate = list.some((r) => r.dateCreation);
    if (hasDate) {
      list.sort((a, b) => {
        const ta = a.dateCreation ? new Date(a.dateCreation).getTime() : 0;
        const tb = b.dateCreation ? new Date(b.dateCreation).getTime() : 0;
        return anciennete === "recent" ? tb - ta : ta - tb;
      });
    }
    return list;
  }, [rawRows, excludedActivityKeys, excludedTailleKeys, anciennete]);

  const fetchPage = useCallback(
    async (nextPage: number, append: boolean) => {
      const t = Array.from(tailleSet);
      if (t.length === 0) {
        setError("Coche au moins une taille d’entreprise.");
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const sp = new URLSearchParams();
        sp.set("secteur", secteur);
        sp.set("ville", ville.trim());
        sp.set("rayon", String(rayonKm));
        sp.set("tailles", t.join(","));
        sp.set("page", String(nextPage));
        const res = await fetch(`/api/entreprises/search?${sp.toString()}`);
        const data = (await res.json()) as EntrepriseSearchResponse;
        if (data.error) setError(data.error);
        setTotal(data.total);
        setPage(data.page);
        if (append) {
          setRawRows((prev) => {
            const seen = new Set(prev.map((p) => p.siret));
            const merged = [...prev];
            for (const e of data.entreprises) {
              if (!seen.has(e.siret)) {
                seen.add(e.siret);
                merged.push(e);
              }
            }
            return merged;
          });
        } else {
          setRawRows(data.entreprises);
          setCheckedSirets(new Set());
          setExcludedActivityKeys(new Set());
          setExcludedTailleKeys(new Set());
        }
      } catch {
        setError("Impossible de contacter l’API de recherche.");
        if (!append) setRawRows([]);
      } finally {
        setLoading(false);
        setHasSearched(true);
      }
    },
    [secteur, ville, rayonKm, tailleSet]
  );

  function handleSearch() {
    if (!ville.trim()) {
      setError("Indique une ville ou un code postal.");
      return;
    }
    setPage(0);
    void fetchPage(0, false);
  }

  function setActivityVisible(key: string, visible: boolean) {
    setExcludedActivityKeys((prev) => {
      const n = new Set(prev);
      if (visible) n.delete(key);
      else n.add(key);
      return n;
    });
  }

  function setTailleVisible(key: string, visible: boolean) {
    setExcludedTailleKeys((prev) => {
      const n = new Set(prev);
      if (visible) n.delete(key);
      else n.add(key);
      return n;
    });
  }

  function toggleRow(siret: string) {
    setCheckedSirets((prev) => {
      const n = new Set(prev);
      if (n.has(siret)) n.delete(siret);
      else n.add(siret);
      return n;
    });
  }

  function toggleAll(checked: boolean) {
    if (!checked) {
      setCheckedSirets(new Set());
      return;
    }
    setCheckedSirets(new Set(filteredRows.map((r) => r.siret)));
  }

  function handleAdd(row: EntrepriseSearchResult) {
    ajouterEntreprise(toSelection(row));
  }

  function handleAddChecked() {
    filteredRows.forEach((r) => {
      if (checkedSirets.has(r.siret)) ajouterEntreprise(toSelection(r));
    });
    setCheckedSirets(new Set());
  }

  const hasMore = rawRows.length < total;

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-[#0F0F0F] pb-28 text-[#F5F5F5]">
        <div className="mx-auto max-w-6xl px-4 py-8">
          {/* Fil d’étapes */}
          <div className="mb-8 flex flex-wrap items-center justify-center gap-2 text-xs sm:justify-between sm:gap-4">
            {(
              [
                { n: 1, label: "Recherchez vos cibles" },
                { n: 2, label: "Sélectionnez les entreprises" },
                { n: 3, label: "Ma sélection" },
              ] as const
            ).map(({ n, label }, i) => (
              <div key={n} className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold",
                    step >= n ? "bg-[#F97316] text-white" : "bg-[#2A2A2A] text-[#737373]"
                  )}
                >
                  {n}
                </span>
                <span className={cn("hidden font-medium sm:inline", step >= n ? "text-[#F5F5F5]" : "text-[#525252]")}>
                  {label}
                </span>
                {i < 2 && <span className="hidden text-[#2A2A2A] sm:inline">→</span>}
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] p-5 shadow-xl sm:p-8">
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Entreprises</h1>
            <p className="mt-1 text-sm text-[#A3A3A3]">
              Recherche et sélection pour vos candidatures spontanées (données SIRENE via l’INSEE).
            </p>

            <div className="mt-8">
              <SearchBar
                secteur={secteur}
                ville={ville}
                rayonKm={rayonKm}
                loading={loading}
                onSecteurChange={setSecteur}
                onVilleChange={setVille}
                onRayonChange={setRayonKm}
                onSearch={() => void handleSearch()}
              />
            </div>

            <div className="mt-6">
              <FilterChips
                tailles={tailleSet}
                onTaillesChange={setTailleSet}
                anciennete={anciennete}
                onAncienneteChange={setAnciennete}
              />
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          {loading && <SearchLoading active={loading} />}

          {!loading && hasSearched && rawRows.length === 0 && !error && (
            <p className="mt-8 text-center text-sm text-[#A3A3A3]">
              Peu de résultats ? Élargis le rayon ou essaie un autre secteur.
            </p>
          )}

          {!loading && rawRows.length > 0 && (
            <div className="mt-8 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <p className="text-sm text-[#A3A3A3]">
                  <span className="font-semibold text-[#F5F5F5]">{filteredRows.length}</span> affichée(s) sur{" "}
                  <span className="tabular-nums">{total}</span> résultat(s) INSEE
                </p>
                <SwipeMode mode={viewMode} onModeChange={setViewMode} />
              </div>

              <ActivityFilters
                activities={activities}
                excludedActivityKeys={excludedActivityKeys}
                onActivityChecked={setActivityVisible}
                tailleOptions={TAILLE_FILTER_OPTIONS}
                excludedTailleKeys={excludedTailleKeys}
                onTailleChecked={setTailleVisible}
              />

              {viewMode === "list" && filteredRows.length === 0 && (
                <p className="text-center text-sm text-[#737373]">
                  Aucune entreprise ne correspond aux filtres activités / tailles. Réactive des cases ci-dessus.
                </p>
              )}
              {viewMode === "list" && filteredRows.length > 0 && (
                <EntrepriseTable
                  rows={filteredRows}
                  checkedSirets={checkedSirets}
                  onToggleRow={toggleRow}
                  onToggleAll={toggleAll}
                  isInStore={isSelectedStore}
                  onAdd={handleAdd}
                  onVoir={(row) => {
                    setDetail(row);
                    setDetailWebsite("loading");
                    fetch(`/api/entreprises/website?siren=${row.siren ?? ""}&nom=${encodeURIComponent(row.nom)}`)
                      .then((r) => r.json())
                      .then((d: { url: string | null }) => setDetailWebsite(d.url))
                      .catch(() => setDetailWebsite(null));
                  }}
                />
              )}

              {hasMore && (
                <div className="flex justify-center pt-2">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => void fetchPage(page + 1, true)}
                    className="rounded-xl border border-[#2A2A2A] bg-[#141414] px-6 py-2.5 text-sm font-semibold text-[#F5F5F5] transition hover:border-[#F97316]/50 disabled:opacity-50"
                  >
                    Charger plus
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <SelectionBar
          checkedCount={checkedSirets.size}
          selectionCount={selection.length}
          onAddChecked={handleAddChecked}
          onOpenSelection={() => setSelectionOpen(true)}
        />

        {/* Détail entreprise */}
        {detail && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
            role="dialog"
            aria-modal
            aria-labelledby="entreprise-detail-title"
          >
            <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-3">
                <h2 id="entreprise-detail-title" className="text-lg font-bold text-[#F5F5F5]">
                  {detail.nom}
                </h2>
                <button
                  type="button"
                  onClick={() => { setDetail(null); setDetailWebsite(null); }}
                  className="rounded-lg p-1 text-[#737373] hover:bg-[#2A2A2A] hover:text-[#F5F5F5]"
                  aria-label="Fermer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <dl className="mt-4 space-y-2 text-sm">
                <div>
                  <dt className="text-[#525252]">SIRET</dt>
                  <dd className="font-mono text-[#F5F5F5]">{detail.siret}</dd>
                </div>
                <div>
                  <dt className="text-[#525252]">Adresse</dt>
                  <dd className="text-[#A3A3A3]">
                    {detail.adresse || `${detail.codePostal} ${detail.ville}`}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#525252]">Activité (NAF)</dt>
                  <dd className="text-[#A3A3A3]">{detail.libelleNaf || detail.naf}</dd>
                </div>
                <div>
                  <dt className="text-[#525252]">Taille</dt>
                  <dd className="text-[#A3A3A3]">
                    {detail.taille}
                    {detail.effectifLabel && detail.effectifLabel !== "Non renseigné" && (
                      <span className="ml-2 text-[#737373]">· {detail.effectifLabel}</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#525252]">Site web</dt>
                  <dd className="mt-0.5">
                    {detailWebsite === "loading" && (
                      <span className="text-xs text-[#737373] animate-pulse">Recherche en cours…</span>
                    )}
                    {detailWebsite && detailWebsite !== "loading" && (
                      <a
                        href={detailWebsite}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#F97316] underline-offset-2 hover:underline break-all text-sm"
                      >
                        {detailWebsite.replace(/^https?:\/\/(www\.)?/, "")}
                      </a>
                    )}
                    {detailWebsite === null && (
                      <span className="text-xs text-[#525252]">Non trouvé</span>
                    )}
                  </dd>
                </div>
                {detail.annuaireUrl && (
                  <div>
                    <dt className="text-[#525252]">Fiche officielle</dt>
                    <dd>
                      <a
                        href={detail.annuaireUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#737373] text-xs underline-offset-2 hover:underline"
                      >
                        Annuaire des Entreprises →
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
              <button
                type="button"
                onClick={() => {
                  handleAdd(detail);
                  setDetail(null);
                }}
                className="mt-6 w-full rounded-xl bg-[#F97316] py-2.5 text-sm font-semibold text-white hover:bg-[#EA6C0A]"
              >
                Ajouter à ma sélection
              </button>
            </div>
          </div>
        )}

        {/* Panneau Ma sélection */}
        {selectionOpen && (
          <div
            className="fixed inset-0 z-50 flex justify-end bg-black/60"
            role="dialog"
            aria-modal
            aria-labelledby="selection-title"
          >
            <div className="flex h-full w-full max-w-md flex-col border-l border-[#2A2A2A] bg-[#1A1A1A] shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#2A2A2A] px-4 py-4">
                <h2 id="selection-title" className="text-lg font-bold text-[#F5F5F5]">
                  Ma sélection
                </h2>
                <button
                  type="button"
                  onClick={() => setSelectionOpen(false)}
                  className="rounded-lg p-1 text-[#737373] hover:bg-[#2A2A2A]"
                  aria-label="Fermer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <ul className="flex-1 overflow-y-auto p-4">
                {selection.length === 0 ? (
                  <p className="text-sm text-[#737373]">Aucune entreprise pour l’instant.</p>
                ) : (
                  selection.map((e) => (
                    <li
                      key={e.siret}
                      className="mb-3 flex items-start justify-between gap-2 rounded-xl border border-[#2A2A2A] bg-[#141414] p-3"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-[#F5F5F5]">{e.nom}</p>
                        <p className="text-xs text-[#737373]">
                          {e.codePostal} {e.ville}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => retirerEntreprise(e.siret)}
                        className="shrink-0 text-xs font-medium text-red-400 hover:underline"
                      >
                        Retirer
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
