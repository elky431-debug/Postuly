"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronRight, RefreshCw } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ApplicationsTable } from "@/components/relance/ApplicationsTable";
import { CoverLetterDrawer } from "@/components/relance/CoverLetterDrawer";
import { RelanceConfirmModal } from "@/components/relance/RelanceConfirmModal";
import { createClient } from "@/lib/supabase";
import type { Application, Campaign } from "@/lib/types";
import { Button } from "@/components/ui/button";

export default function RelanceCampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = typeof params.campaignId === "string" ? params.campaignId : "";

  const [token, setToken] = useState("");
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [letterAppId, setLetterAppId] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [bulkIds, setBulkIds] = useState<string[] | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      router.push("/");
      return;
    }
    setToken(session.access_token);
    const res = await fetch(`/api/relance/campaigns/${campaignId}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) {
      router.push("/relance");
      return;
    }
    const data = (await res.json()) as { campaign: Campaign; applications: Application[] };
    setCampaign(data.campaign);
    setApplications(data.applications ?? []);
  }, [campaignId, router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await load();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const sentCount = applications.filter((a) => a.status === "sent").length;
  const lastSent = applications
    .map((a) => a.sent_at)
    .filter(Boolean)
    .sort()
    .pop();

  async function sendAll() {
    if (!token) return;
    setBusy(true);
    setBanner(null);
    try {
      const res = await fetch(`/api/relance/campaigns/${campaignId}/send-all`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await res.json()) as { message?: string; detail?: string; error?: string };
      if (!res.ok) throw new Error(json.detail ?? json.error ?? "Échec");
      setBanner({ type: "ok", text: json.message ?? "Relances envoyées." });
      await load();
    } catch (e) {
      setBanner({ type: "err", text: e instanceof Error ? e.message : "Erreur" });
    } finally {
      setBusy(false);
    }
  }

  async function relanceIds(ids: string[]) {
    if (!token || ids.length === 0) return;
    setBusy(true);
    setBanner(null);
    try {
      const res = await fetch(`/api/n8n/relance-applications`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ applicationIds: ids }),
      });
      const json = (await res.json()) as { message?: string; detail?: string; error?: string };
      if (!res.ok) throw new Error(json.detail ?? json.error ?? "Échec");
      setBanner({ type: "ok", text: json.message ?? "Relances envoyées." });
      setBulkIds(null);
      await load();
    } catch (e) {
      setBanner({ type: "err", text: e instanceof Error ? e.message : "Erreur" });
    } finally {
      setBusy(false);
    }
  }

  async function relanceOne(id: string) {
    await relanceIds([id]);
  }

  const title = campaign?.job_title ?? "Campagne";

  return (
    <DashboardLayout>
      <div className="min-h-[calc(100vh-4rem)] bg-white px-6 pb-20 pt-8 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-[1520px] space-y-6">
          <nav className="flex flex-wrap items-center gap-1 text-sm text-stone-500">
            <Link href="/relance" className="hover:text-orange-600">
              Relance
            </Link>
            <ChevronRight className="h-4 w-4 shrink-0" />
            <span className="font-medium text-stone-800">{title}</span>
          </nav>

          <header className="rounded-2xl border border-stone-200 bg-white px-6 py-5 shadow-[0_16px_40px_-30px_rgba(15,23,42,0.45)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-stone-900">{title}</h1>
                <p className="mt-1 text-sm text-stone-500">
                  {applications.length} entreprise{applications.length > 1 ? "s" : ""} ·{" "}
                  {sentCount} relance{sentCount > 1 ? "s" : ""} possible{sentCount > 1 ? "s" : ""} ·
                  Dernier envoi :{" "}
                  {lastSent ? new Date(lastSent).toLocaleDateString("fr-FR") : "—"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl border-stone-300"
                  disabled={busy}
                  onClick={() => void load()}
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${busy ? "animate-spin" : ""}`} />
                  Actualiser
                </Button>
                <Button
                  type="button"
                  disabled={sentCount === 0 || busy}
                  className="rounded-xl bg-orange-500 text-white hover:bg-orange-600"
                  onClick={() => setBulkIds(applications.filter((a) => a.status === "sent").map((a) => a.id))}
                >
                  Tout relancer
                </Button>
              </div>
            </div>
          </header>

          {banner && (
            <div
              role="status"
              className={
                banner.type === "ok"
                  ? "rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900"
                  : "rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
              }
            >
              {banner.text}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-16">
              <div
                className="h-10 w-10 animate-spin rounded-full border-[3px] border-orange-100 border-t-orange-500"
                aria-hidden
              />
            </div>
          ) : (
            <ApplicationsTable
              applications={applications}
              busy={busy}
              onOpenLetter={(id) => setLetterAppId(id)}
              onRequestBulkRelance={(ids) => setBulkIds(ids)}
              onRelanceOne={(id) => void relanceOne(id)}
            />
          )}
        </div>
      </div>

      <CoverLetterDrawer
        applicationId={letterAppId}
        token={token}
        onClose={() => setLetterAppId(null)}
        onAfterSend={() => void load()}
      />

      <RelanceConfirmModal
        open={bulkIds != null && bulkIds.length > 0}
        title={
          bulkIds && sentCount > 0 && bulkIds.length === sentCount
            ? "Relancer toutes les candidatures « Envoyé »"
            : "Relancer la sélection"
        }
        message="Les e-mails partent via le même pipeline que l’envoi initial (Gmail + n8n si configuré), avec le drapeau is_relance pour n8n."
        count={bulkIds?.length ?? 0}
        loading={busy}
        onCancel={() => setBulkIds(null)}
        onConfirm={() => bulkIds && void relanceIds(bulkIds)}
      />
    </DashboardLayout>
  );
}
