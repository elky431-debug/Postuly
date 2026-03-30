"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";

/**
 * Connexion OAuth Gmail + affichage du statut (utilisé sur /settings et /dashboard/parametres).
 */
export function GmailIntegrationCard() {
  const searchParams = useSearchParams();
  const gmailSuccess = searchParams.get("success") === "gmail_connected";
  const gmailError = searchParams.get("error");
  const [connecting, setConnecting] = useState(false);
  const [status, setStatus] = useState<{ connected: boolean; email: string | null } | null>(null);

  const loadStatus = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setStatus(null);
      return;
    }
    const res = await fetch("/api/oauth/gmail/status", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) {
      setStatus({ connected: false, email: null });
      return;
    }
    const data = (await res.json()) as { connected?: boolean; email?: string | null };
    setStatus({ connected: Boolean(data.connected), email: data.email ?? null });
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus, gmailSuccess]);

  async function handleConnectGmail() {
    setConnecting(true);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const res = await fetch("/api/oauth/gmail/start", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      console.error(data.error ?? "Démarrage OAuth impossible");
    } finally {
      setConnecting(false);
    }
  }

  const errorLabels: Record<string, string> = {
    oauth_cancelled: "Connexion annulée.",
    token_failed: "Échange du code OAuth refusé par Google.",
    invalid_state: "Session OAuth expirée ou invalide — réessaie.",
    no_refresh_token: "Google n’a pas renvoyé de refresh token. Réessaie avec « consent ».",
    db_failed: "Enregistrement en base impossible.",
    config: "Variables Google manquantes côté serveur.",
  };

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h3 className="text-base font-semibold text-neutral-900">Compte e-mail d&apos;envoi</h3>
      <p className="mt-1 text-sm text-neutral-600">
        Les candidatures validées peuvent être envoyées depuis ta boîte Gmail personnelle (workflow
        n8n).
      </p>

      {gmailSuccess && (
        <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Gmail connecté avec succès.
        </div>
      )}

      {gmailError && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {errorLabels[gmailError] ?? "Erreur lors de la connexion Gmail."}
        </div>
      )}

      {status?.connected && (
        <p className="mt-4 text-sm text-neutral-700">
          Connecté : <span className="font-medium">{status.email ?? "—"}</span>
        </p>
      )}

      <div className="mt-4">
        <button
          type="button"
          onClick={() => void handleConnectGmail()}
          disabled={connecting}
          className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-800 transition hover:bg-neutral-50 disabled:opacity-50"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          {connecting ? "Redirection…" : status?.connected ? "Reconnecter Gmail" : "Connecter mon Gmail"}
        </button>
      </div>
    </div>
  );
}
