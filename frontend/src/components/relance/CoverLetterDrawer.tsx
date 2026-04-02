"use client";

import { useCallback, useEffect, useState } from "react";
import type { RelanceLetterPayload } from "@/types/relance";
import { cn } from "@/lib/utils";

type CoverLetterDrawerProps = {
  applicationId: string | null;
  token: string;
  onClose: () => void;
  onAfterSend: () => void;
};

function joursDepuisEnvoi(iso: string | null): number | null {
  if (!iso) return null;
  return (Date.now() - new Date(iso).getTime()) / 86400000;
}

export function CoverLetterDrawer({
  applicationId,
  token,
  onClose,
  onAfterSend,
}: CoverLetterDrawerProps) {
  const [data, setData] = useState<RelanceLetterPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [regenLoading, setRegenLoading] = useState(false);

  const load = useCallback(async () => {
    if (!applicationId || !token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/relance/applications/${applicationId}/letter`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await res.json()) as RelanceLetterPayload | { error?: string; detail?: string };
      if (!res.ok) {
        throw new Error(
          typeof (json as { detail?: string }).detail === "string"
            ? (json as { detail: string }).detail
            : (json as { error?: string }).error ?? "Erreur"
        );
      }
      const p = json as RelanceLetterPayload;
      setData(p);
      setDraft(p.body);
      setEditMode(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [applicationId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveLetter() {
    if (!applicationId || !token) return;
    setError(null);
    const res = await fetch(`/api/relance/applications/${applicationId}/letter`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ body: draft }),
    });
    if (!res.ok) {
      const t = await res.text();
      setError(t.slice(0, 200));
      return;
    }
    await load();
    setEditMode(false);
  }

  async function regenerate() {
    if (!applicationId || !token) return;
    setRegenLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/relance/applications/${applicationId}/regenerate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t.slice(0, 200));
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Régénération impossible");
    } finally {
      setRegenLoading(false);
    }
  }

  async function sendRelance() {
    if (!applicationId || !token) return;
    setSending(true);
    setError(null);
    try {
      if (editMode) {
        await saveLetter();
      }
      const res = await fetch(`/api/relance/applications/${applicationId}/send`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t.slice(0, 240));
      }
      onAfterSend();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Envoi impossible");
    } finally {
      setSending(false);
    }
  }

  if (!applicationId) return null;

  const jours = joursDepuisEnvoi(data?.sentAt ?? null);
  const warnJeune = jours != null && jours < 5 && data?.rawStatus === "sent";

  return (
    <>
      <button
        type="button"
        aria-label="Fermer"
        className="fixed inset-0 z-[80] cursor-default border-0 bg-stone-900/35 p-0 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <aside
        className={cn(
          "fixed z-[90] flex flex-col bg-white shadow-xl",
          "inset-0 max-h-full sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-full sm:max-w-lg"
        )}
      >
        <header className="shrink-0 border-b border-stone-200 px-5 py-4">
          <div className="mb-2 h-0.5 w-14 rounded-full bg-orange-500" aria-hidden />
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-stone-900">
                Lettre — {data?.companyName ?? "…"}
              </p>
              <p className="mt-1 text-xs text-stone-500">
                {data?.sentAt
                  ? `Envoyée le ${new Date(data.sentAt).toLocaleDateString("fr-FR")}`
                  : "Pas encore envoyée"}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-lg border border-stone-200 px-2.5 py-1 text-lg leading-none text-stone-500 hover:bg-stone-50"
            >
              ×
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading && <p className="text-sm text-stone-500">Chargement…</p>}
          {error && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </div>
          )}
          {warnJeune && (
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
              La candidature initiale date de moins de 5 jours — vérifie avant de relancer.
            </div>
          )}

          {data && !loading && (
            <>
              <div className="mb-3 space-y-1 text-xs text-stone-500">
                <p>
                  <span className="font-medium text-stone-700">Objet (relance) :</span>{" "}
                  {data.subjectRelance}
                </p>
                <p>
                  <span className="font-medium text-stone-700">Objet (1er envoi) :</span>{" "}
                  {data.subjectInitial}
                </p>
              </div>

              {editMode ? (
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  className="min-h-[240px] w-full rounded-xl border border-stone-200 p-3 text-sm text-stone-800 outline-none focus:border-orange-300"
                />
              ) : (
                <div className="whitespace-pre-wrap rounded-xl border border-stone-200 bg-stone-50/80 p-4 text-sm leading-relaxed text-stone-800">
                  {data.body || "—"}
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditMode((v) => !v);
                    if (editMode && data) setDraft(data.body);
                  }}
                  className="rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
                >
                  {editMode ? "Lecture" : "Modifier la lettre"}
                </button>
                <button
                  type="button"
                  disabled={regenLoading}
                  onClick={() => void regenerate()}
                  className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-medium text-orange-800 hover:bg-orange-100 disabled:opacity-50"
                >
                  {regenLoading ? "Régénération…" : "Régénérer avec l’IA"}
                </button>
              </div>
            </>
          )}
        </div>

        <footer className="shrink-0 border-t border-stone-200 px-5 py-4">
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
            >
              Annuler
            </button>
            {editMode && (
              <button
                type="button"
                onClick={() => void saveLetter()}
                className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
              >
                Enregistrer
              </button>
            )}
            <button
              type="button"
              disabled={sending || data?.rawStatus !== "sent" || !data}
              title={
                data?.rawStatus !== "sent"
                  ? "Seules les candidatures au statut « Envoyé » peuvent être relancées."
                  : undefined
              }
              onClick={() => void sendRelance()}
              className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {sending ? "Envoi…" : "Valider & envoyer la relance"}
            </button>
          </div>
        </footer>
      </aside>
    </>
  );
}
