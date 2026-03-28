"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { AppLayout } from "@/components/layout/app-layout";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { Button } from "@/components/ui/button";
import { Columns3, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import type { Application, ApplicationStatus } from "@/lib/types";

export default function KanbanPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState("");

  const loadApplications = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;
    setToken(session.access_token);

    try {
      const data = await api<Application[]>("/api/applications/", {
        token: session.access_token,
      });
      // Ne montrer dans le Kanban que les candidatures envoyées ou au-delà
      const kanbanApps = data.filter((a) =>
        ["sent", "followed_up", "replied", "interview", "offer", "rejected"].includes(
          a.status
        )
      );
      setApplications(kanbanApps);
    } catch {
      // Sera chargé quand le backend sera prêt
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
    // Optimistic update
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
      // Rollback en cas d'erreur
      loadApplications();
    }
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Columns3 className="w-6 h-6 text-indigo-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Suivi des candidatures
              </h1>
              <p className="text-gray-600 mt-0.5">
                Déplace les cartes pour mettre à jour le statut.
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={loadApplications}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Actualiser
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
        ) : applications.length === 0 ? (
          <div className="text-center py-20">
            <Columns3 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Aucune candidature envoyée
            </h3>
            <p className="text-gray-500 max-w-md mx-auto">
              Lance une campagne et envoie tes premières candidatures pour les
              voir apparaître ici.
            </p>
          </div>
        ) : (
          <KanbanBoard
            applications={applications}
            onStatusChange={handleStatusChange}
          />
        )}
      </div>
    </AppLayout>
  );
}
