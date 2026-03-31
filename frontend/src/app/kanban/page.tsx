"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { KanbanBoardEditorial } from "@/components/kanban/kanban-board-editorial";
import { Button } from "@/components/ui/button";
import { Columns3, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { getAccessTokenForApi } from "@/lib/auth-session";
import type { Application, ApplicationStatus } from "@/lib/types";

/** Statuts affichés dans les 3 colonnes du Kanban. */
const KANBAN_STATUSES: ApplicationStatus[] = [
  "sent",
  "followed_up",
  "rejected",
];

export default function KanbanPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  /** Candidatures « répondu / entretien / offre » (hors colonnes). */
  const [countOtherPipeline, setCountOtherPipeline] = useState(0);

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

  return (
    <DashboardLayout>
      <div
        className="min-h-[calc(100vh-4rem)] px-5 pb-20 pt-8 sm:px-8 lg:px-12"
        style={{
          background:
            "linear-gradient(180deg, #FFF9F5 0%, #F7F6F3 45%, #F3F1ED 100%)",
          /* DM Sans : interface lisible, sans le rendu « étiré » de Syne */
          fontFamily:
            "var(--font-dm-sans), var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div className="mx-auto max-w-[1600px] space-y-8">
          {/* En-tête */}
          <header className="relative overflow-hidden rounded-3xl border border-orange-100/80 bg-white shadow-[0_4px_32px_-8px_rgba(254,106,46,0.12),0_1px_2px_rgba(0,0,0,0.04)]">
            <div
              className="h-1.5 w-full bg-gradient-to-r from-[#FE6A2E] via-[#FF9F4A] to-[#FFB347]"
              aria-hidden
            />
            <div className="relative px-6 py-7 sm:px-10 sm:py-9">
              <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-[#FE6A2E]/[0.06] blur-3xl" />
              <div className="pointer-events-none absolute -bottom-12 -left-10 h-36 w-36 rounded-full bg-[#FFB347]/[0.08] blur-2xl" />
              <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-4">
                  <span
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FFF1E3] to-white shadow-inner ring-1 ring-orange-100/90"
                    aria-hidden
                  >
                    <Columns3 className="h-6 w-6 text-[#FE6A2E]" strokeWidth={2} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FE6A2E]/90">
                      Pipeline
                    </p>
                    <h1 className="mt-1 text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
                      Suivi des candidatures
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-600">
                      Glisse les cartes entre les colonnes pour mettre à jour le statut. Les réponses,
                      entretiens et offres restent visibles depuis la fiche candidature.
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  disabled={loading}
                  size="sm"
                  className="shrink-0 self-start rounded-xl border-0 bg-gradient-to-r from-[#FE6A2E] to-[#FFB347] px-5 text-white shadow-md shadow-orange-500/25 transition hover:brightness-[1.03] hover:shadow-lg disabled:opacity-40"
                  onClick={loadApplications}
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                  Actualiser
                </Button>
              </div>
            </div>
          </header>

          {loadError && (
            <div
              role="alert"
              className="rounded-2xl border border-red-200/80 bg-red-50/90 px-5 py-4 text-sm text-red-900 shadow-sm"
            >
              {loadError}
            </div>
          )}

          {!loadError &&
            applications.length === 0 &&
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
            applications.length === 0 &&
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
              applications={applications}
              onStatusChange={handleStatusChange}
            />
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
