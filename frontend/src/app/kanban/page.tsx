"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { KanbanBoardEditorial } from "@/components/kanban/kanban-board-editorial";
import { Button } from "@/components/ui/button";
import { SelectMenu, type SelectMenuOption } from "@/components/ui/select-menu";
import { Columns3, RefreshCw, Send } from "lucide-react";
import { api } from "@/lib/api";
import { getAccessTokenForApi } from "@/lib/auth-session";
import type { Application, ApplicationStatus } from "@/lib/types";

/** Statuts affichés dans les 3 colonnes du Kanban. */
const KANBAN_STATUSES: ApplicationStatus[] = [
  "sent",
];

const KANBAN_CONTRACT_OPTIONS: SelectMenuOption[] = [
  { value: "all", label: "Tous" },
  { value: "cdi", label: "CDI" },
  { value: "cdd", label: "CDD" },
  { value: "stage", label: "Stage" },
  { value: "alternance", label: "Alternance" },
  { value: "freelance", label: "Freelance" },
];

const KANBAN_DATE_OPTIONS: SelectMenuOption[] = [
  { value: "all", label: "Toutes" },
  { value: "today", label: "Aujourd'hui" },
  { value: "7d", label: "7 derniers jours" },
  { value: "30d", label: "30 derniers jours" },
  { value: "custom", label: "Personnalisé" },
];

const KANBAN_SORT_OPTIONS: SelectMenuOption[] = [
  { value: "recent", label: "Plus récent" },
  { value: "oldest", label: "Plus ancien" },
  { value: "company_az", label: "A→Z entreprise" },
];

export default function KanbanPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  /** Candidatures « répondu / entretien / offre » (hors colonnes). */
  const [countOtherPipeline, setCountOtherPipeline] = useState(0);
  const [contractFilter, setContractFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState("recent");

  const loadApplications = useCallback(async () => {
    setLoadError(null);
    const supabase = createClient();
    const accessToken = await getAccessTokenForApi(supabase);
    if (!accessToken) {
      setLoadError(
        "Session indisponible ou expirée. Recharge la page ou reconnecte-toi."
      );
      setApplications([]);
      setCountOtherPipeline(0);
      setLoading(false);
      return;
    }
    setToken(accessToken);

    try {
      const data = await api<Application[]>("/api/applications/", {
        token: accessToken,
      });
      const kanbanApps = data.filter((a) =>
        KANBAN_STATUSES.includes(a.status)
      );
      setApplications(kanbanApps);
      const other = data.filter((a) =>
        ["replied", "interview", "offer"].includes(a.status)
      ).length;
      setCountOtherPipeline(other);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Erreur de chargement");
      setApplications([]);
      setCountOtherPipeline(0);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadApplications();
  }, [loadApplications]);

  async function handleStatusChange(
    applicationId: string,
    newStatus: ApplicationStatus
  ) {
    setApplications((prev) =>
      prev.map((app) =>
        app.id === applicationId ? { ...app, status: newStatus } : app
      )
    );

    try {
      await api(`/api/applications/${applicationId}`, {
        method: "PATCH",
        token,
        body: { status: newStatus },
      });
    } catch {
      loadApplications();
    }
  }

  const displayedApplications = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    function appDate(app: Application): Date {
      return new Date(app.sent_at ?? app.created_at);
    }

    const filtered = applications.filter((app) => {
      const contract = (app.campaign?.contract_type ?? "").toLowerCase();
      const dt = appDate(app);

      const contractOk = contractFilter === "all" ? true : contract === contractFilter;

      let dateOk = true;
      if (dateFilter === "today") {
        dateOk = dt >= startOfToday;
      } else if (dateFilter === "7d") {
        const cutoff = new Date(now);
        cutoff.setDate(cutoff.getDate() - 7);
        dateOk = dt >= cutoff;
      } else if (dateFilter === "30d") {
        const cutoff = new Date(now);
        cutoff.setDate(cutoff.getDate() - 30);
        dateOk = dt >= cutoff;
      } else if (dateFilter === "custom") {
        const from = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
        const to = dateTo ? new Date(`${dateTo}T23:59:59`) : null;
        if (from && dt < from) dateOk = false;
        if (to && dt > to) dateOk = false;
      }

      return contractOk && dateOk;
    });

    const sorted = [...filtered];
    if (sortBy === "recent") {
      sorted.sort(
        (a, b) =>
          new Date(b.sent_at ?? b.created_at).getTime() -
          new Date(a.sent_at ?? a.created_at).getTime()
      );
    } else if (sortBy === "oldest") {
      sorted.sort(
        (a, b) =>
          new Date(a.sent_at ?? a.created_at).getTime() -
          new Date(b.sent_at ?? b.created_at).getTime()
      );
    } else if (sortBy === "company_az") {
      sorted.sort((a, b) =>
        (a.company?.name ?? "").localeCompare(b.company?.name ?? "", "fr", {
          sensitivity: "base",
        })
      );
    }

    return sorted;
  }, [applications, contractFilter, dateFilter, dateFrom, dateTo, sortBy]);

  const countSent = displayedApplications.filter((a) => a.status === "sent").length;

  return (
    <DashboardLayout>
      <div className="min-h-[calc(100vh-4rem)] bg-white px-6 pb-20 pt-8 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-[1520px] space-y-6">
          <header className="rounded-2xl border border-stone-200 bg-white px-6 py-5 shadow-[0_16px_40px_-30px_rgba(15,23,42,0.45)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 ring-1 ring-orange-100">
                  <Columns3 className="h-5 w-5 text-orange-500" strokeWidth={2} />
                </span>
                <div>
                  <h1 className="text-[28px] font-semibold tracking-tight text-stone-900">
                    Kanban candidatures
                  </h1>
                  <p className="mt-1 text-sm text-stone-500">
                    Déplace les cartes entre Envoyé, Relancé et Refusé pour mettre à jour le pipeline.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                disabled={loading}
                size="sm"
                className="shrink-0 rounded-xl bg-orange-500 px-5 text-white shadow-[0_10px_24px_-10px_rgba(249,115,22,0.75)] transition hover:bg-orange-600 disabled:opacity-40"
                onClick={loadApplications}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Actualiser
              </Button>
            </div>
          </header>

          <section className="grid grid-cols-1 gap-3 sm:grid-cols-1">
            <div className="rounded-xl border border-stone-200 bg-white p-4">
              <div className="flex items-center gap-2 text-stone-500">
                <Send className="h-4 w-4 text-orange-500" />
                <span className="text-xs font-medium">Envoyé</span>
              </div>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-stone-900">{countSent}</p>
            </div>
          </section>

          <section className="rounded-2xl border border-stone-200/90 bg-gradient-to-br from-white via-white to-orange-50/[0.35] p-5 shadow-[0_12px_40px_-28px_rgba(15,23,42,0.35)] sm:p-6">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-stone-400">
              Filtres
            </p>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3 md:gap-6">
              <div>
                <span className="block text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Type de contrat
                </span>
                <SelectMenu
                  label="Type de contrat"
                  options={KANBAN_CONTRACT_OPTIONS}
                  value={contractFilter}
                  onChange={setContractFilter}
                />
              </div>

              <div>
                <span className="block text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Date d&apos;envoi
                </span>
                <SelectMenu
                  label="Date d'envoi"
                  options={KANBAN_DATE_OPTIONS}
                  value={dateFilter}
                  onChange={setDateFilter}
                />
              </div>

              <div>
                <span className="block text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Tri
                </span>
                <SelectMenu
                  label="Tri"
                  options={KANBAN_SORT_OPTIONS}
                  value={sortBy}
                  onChange={setSortBy}
                />
              </div>
            </div>

            {dateFilter === "custom" && (
              <div className="mt-5 grid grid-cols-1 gap-4 border-t border-stone-200/70 pt-5 sm:grid-cols-2">
                <label className="block">
                  <span className="block text-xs font-semibold uppercase tracking-wide text-stone-500">
                    Du
                  </span>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="mt-2 h-11 w-full rounded-xl border border-stone-200 bg-white px-3.5 text-sm text-stone-800 shadow-sm outline-none transition-shadow focus:border-orange-200 focus:ring-2 focus:ring-[#FE6A2E]/20"
                  />
                </label>
                <label className="block">
                  <span className="block text-xs font-semibold uppercase tracking-wide text-stone-500">
                    Au
                  </span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="mt-2 h-11 w-full rounded-xl border border-stone-200 bg-white px-3.5 text-sm text-stone-800 shadow-sm outline-none transition-shadow focus:border-orange-200 focus:ring-2 focus:ring-[#FE6A2E]/20"
                  />
                </label>
              </div>
            )}
          </section>

          {loadError && (
            <div
              role="alert"
              className="rounded-2xl border border-red-200/80 bg-red-50/90 px-5 py-4 text-sm text-red-900 shadow-sm"
            >
              {loadError}
            </div>
          )}

          {!loadError &&
            displayedApplications.length === 0 &&
            countOtherPipeline > 0 && (
              <div className="rounded-2xl border border-amber-200/60 bg-gradient-to-r from-amber-50/90 to-orange-50/50 px-5 py-4 text-sm text-amber-950 shadow-sm">
                Tu as{" "}
                <strong>
                  {countOtherPipeline} candidature
                  {countOtherPipeline > 1 ? "s" : ""}
                </strong>{" "}
                avec le statut répondu, entretien ou offre — elles ne sont pas
                listées dans ce tableau (3 colonnes : envoyé, relancé, refus).
              </div>
            )}

          {!loadError &&
            displayedApplications.length === 0 &&
            countOtherPipeline === 0 && (
              <div className="rounded-2xl border border-stone-200/80 bg-white/80 px-5 py-4 text-sm text-stone-600 shadow-sm backdrop-blur-sm">
                Les candidatures apparaissent ici une fois{" "}
                <strong className="text-stone-800">envoyées</strong> (statuts « Envoyé », « Relancé » ou «
                Refus »). Les brouillons et envois en attente d’approbation ne
                sont pas affichés dans ce Kanban.
              </div>
            )}

          {loading ? (
            <div className="flex justify-center py-20">
              <div
                className="h-10 w-10 animate-spin rounded-full border-[3px] border-orange-100 border-t-[#FE6A2E]"
                aria-hidden
              />
            </div>
          ) : (
            <KanbanBoardEditorial
              applications={displayedApplications}
              onStatusChange={handleStatusChange}
            />
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
