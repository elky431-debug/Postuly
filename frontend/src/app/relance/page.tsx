"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { CampaignCard } from "@/components/relance/CampaignCard";
import { CampaignFilters } from "@/components/relance/CampaignFilters";
import { RelanceConfirmModal } from "@/components/relance/RelanceConfirmModal";
import { createClient } from "@/lib/supabase";
import type { RelanceCampaignSummary } from "@/types/relance";

export default function RelancePage() {
  const [token, setToken] = useState("");
  const [campaigns, setCampaigns] = useState<RelanceCampaignSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"all" | "no_reply" | "replied">("all");
  const [date, setDate] = useState<"all" | "7d" | "30d">("all");
  const [search, setSearch] = useState("");
  const [banner, setBanner] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [confirmCampaignId, setConfirmCampaignId] = useState<string | null>(null);
  const [confirmCount, setConfirmCount] = useState(0);
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<Set<string>>(new Set());
  const [confirmBulkIds, setConfirmBulkIds] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;
    setToken(session.access_token);
    const q = new URLSearchParams();
    if (status !== "all") q.set("status", status);
    if (date !== "all") q.set("date", date);
    if (search.trim()) q.set("q", search.trim());
    const res = await fetch(`/api/relance/campaigns?${q}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const data = (await res.json()) as { campaigns?: RelanceCampaignSummary[]; detail?: string };
    if (!res.ok) {
      setCampaigns([]);
      setBanner({ type: "err", text: data.detail ?? "Erreur de chargement" });
      return;
    }
    setCampaigns(data.campaigns ?? []);
  }, [status, date, search]);

  const selectionSentTotal = [...selectedCampaignIds].reduce((acc, id) => {
    const c = campaigns.find((x) => x.id === id);
    return acc + (c?.sentCount ?? 0);
  }, 0);

  function toggleCampaignSelect(id: string) {
    setSelectedCampaignIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function clearSelection() {
    setSelectedCampaignIds(new Set());
  }

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

  useEffect(() => {
    setSelectedCampaignIds(new Set());
  }, [status, date, search]);

  function openConfirmSendAll(campaignId: string) {
    const c = campaigns.find((x) => x.id === campaignId);
    const n = c?.sentCount ?? 0;
    if (n === 0) return;
    setConfirmBulkIds(null);
    setConfirmCampaignId(campaignId);
    setConfirmCount(n);
  }

  function openConfirmBulkSelection() {
    if (selectedCampaignIds.size === 0 || selectionSentTotal === 0) return;
    setConfirmCampaignId(null);
    setConfirmBulkIds([...selectedCampaignIds]);
  }

  async function confirmSendAll() {
    if (!confirmCampaignId || !token) return;
    setBusy(true);
    setBanner(null);
    try {
      const res = await fetch(`/api/relance/campaigns/${confirmCampaignId}/send-all`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await res.json()) as { message?: string; detail?: string; error?: string };
      if (!res.ok) {
        throw new Error(json.detail ?? json.error ?? "Échec envoi");
      }
      setBanner({ type: "ok", text: json.message ?? "Relances envoyées." });
      setConfirmCampaignId(null);
      await load();
    } catch (e) {
      setBanner({ type: "err", text: e instanceof Error ? e.message : "Erreur" });
    } finally {
      setBusy(false);
    }
  }

  async function confirmBulkRelance() {
    if (!confirmBulkIds?.length || !token) return;
    setBusy(true);
    setBanner(null);
    try {
      const res = await fetch("/api/relance/campaigns/bulk-relance", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ campaignIds: confirmBulkIds }),
      });
      const json = (await res.json()) as { message?: string; detail?: string; error?: string };
      if (!res.ok) {
        throw new Error(json.detail ?? json.error ?? "Échec envoi");
      }
      setBanner({ type: "ok", text: json.message ?? "Relances envoyées." });
      setConfirmBulkIds(null);
      clearSelection();
      await load();
    } catch (e) {
      setBanner({ type: "err", text: e instanceof Error ? e.message : "Erreur" });
    } finally {
      setBusy(false);
    }
  }

  const bulkConfirmCount =
    confirmBulkIds?.reduce((acc, id) => {
      const c = campaigns.find((x) => x.id === id);
      return acc + (c?.sentCount ?? 0);
    }, 0) ?? 0;

  return (
    <DashboardLayout>
      <div className="min-h-[calc(100vh-4rem)] bg-white px-6 pb-20 pt-8 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-[1520px] space-y-6">
          <header className="rounded-2xl border border-stone-200 bg-white px-6 py-5 shadow-[0_16px_40px_-30px_rgba(15,23,42,0.45)]">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 ring-1 ring-orange-100">
                <RefreshCw className="h-5 w-5 text-orange-500" strokeWidth={2} />
              </span>
              <div>
                <h1 className="text-[28px] font-semibold tracking-tight text-stone-900">Relance</h1>
                <p className="mt-1 max-w-2xl text-sm text-stone-500">
                  Retrouve tes campagnes, prévisualise les lettres et relance les entreprises qui n’ont pas
                  encore répondu (pipeline Gmail / n8n identique à l’envoi initial, drapeau{" "}
                  <code className="rounded bg-stone-100 px-1 text-xs">is_relance</code>).
                </p>
              </div>
            </div>
          </header>

          <CampaignFilters
            status={status}
            onStatusChange={setStatus}
            date={date}
            onDateChange={setDate}
            search={search}
            onSearchChange={setSearch}
          />

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

          {!loading && campaigns.length > 0 && selectedCampaignIds.size > 0 && (
            <div className="flex flex-col gap-3 rounded-2xl border border-orange-200 bg-orange-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-stone-700">
                <span className="font-semibold text-stone-900">{selectedCampaignIds.size}</span> campagne
                {selectedCampaignIds.size > 1 ? "s" : ""} sélectionnée
                {selectedCampaignIds.size > 1 ? "s" : ""} ·{" "}
                <span className="font-semibold text-orange-700">{selectionSentTotal}</span> candidature
                {selectionSentTotal > 1 ? "s" : ""} « Envoyé » à relancer
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={clearSelection}
                  className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
                >
                  Tout désélectionner
                </button>
                <button
                  type="button"
                  disabled={selectionSentTotal === 0 || busy}
                  onClick={openConfirmBulkSelection}
                  className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Relancer la sélection
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-16">
              <div
                className="h-10 w-10 animate-spin rounded-full border-[3px] border-orange-100 border-t-orange-500"
                aria-hidden
              />
            </div>
          ) : campaigns.length === 0 ? (
            <p className="rounded-2xl border border-stone-200 bg-stone-50/50 px-5 py-8 text-center text-sm text-stone-600">
              Aucune campagne ne correspond aux filtres.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {campaigns.map((c) => (
                <CampaignCard
                  key={c.id}
                  campaign={c}
                  selected={selectedCampaignIds.has(c.id)}
                  onToggleSelect={toggleCampaignSelect}
                  busy={busy}
                  onRelancerToutes={(id) => openConfirmSendAll(id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <RelanceConfirmModal
        open={confirmCampaignId != null}
        title="Relancer en masse"
        message="Tu vas envoyer une relance à toutes les candidatures encore au statut « Envoyé » (sans réponse)."
        count={confirmCount}
        loading={busy}
        onCancel={() => setConfirmCampaignId(null)}
        onConfirm={() => void confirmSendAll()}
      />

      <RelanceConfirmModal
        open={confirmBulkIds != null && confirmBulkIds.length > 0}
        title="Relancer les campagnes sélectionnées"
        message="Une relance sera envoyée pour chaque candidature « Envoyé » dans les campagnes cochées (même pipeline Gmail / n8n)."
        count={bulkConfirmCount}
        loading={busy}
        onCancel={() => setConfirmBulkIds(null)}
        onConfirm={() => void confirmBulkRelance()}
      />
    </DashboardLayout>
  );
}
