"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  ArrowRight,
  Briefcase,
  Calendar,
  Copy,
  FileText,
  Mail,
  Shield,
  Sparkles,
  UserRound,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { createClient } from "@/lib/supabase";
import { api } from "@/lib/api";
import type { Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

function formatDateFr(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function formatDateTimeFr(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

const PROFILE_TYPE_LABEL: Record<string, string> = {
  etudiant: "Étudiant",
  jeune_actif: "Jeune actif",
};

function Card({
  title,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm",
        className
      )}
    >
      <div className="mb-4 flex items-center gap-2 border-b border-neutral-100 pb-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Row({
  label,
  children,
  mono,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
        {label}
      </span>
      <div
        className={cn(
          "min-w-0 text-right text-neutral-900 sm:text-right",
          mono && "font-mono text-sm text-neutral-700"
        )}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Page profil structurée : compte Supabase, dossier Postuly (API), intégrations.
 */
export default function ProfilPage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [gmail, setGmail] = useState<{ connected: boolean; email: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setUser(null);
      setLoading(false);
      return;
    }
    setUser(session.user);

    try {
      const [p, gmailRes] = await Promise.all([
        api<Profile>("/api/profiles/me", { token: session.access_token }),
        fetch("/api/oauth/gmail/status", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }).then((r) => (r.ok ? r.json() : { connected: false, email: null })),
      ]);
      setProfile(p);
      setGmail({
        connected: Boolean(gmailRes.connected),
        email: typeof gmailRes.email === "string" ? gmailRes.email : null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de charger le profil Postuly.");
      setProfile(null);
      setGmail(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const metaName =
    (user?.user_metadata as { full_name?: string } | undefined)?.full_name?.trim() || null;
  const displayName = profile?.full_name?.trim() || metaName || user?.email?.split("@")[0] || "—";
  const profileTypeLabel =
    profile?.profile_type && PROFILE_TYPE_LABEL[profile.profile_type]
      ? PROFILE_TYPE_LABEL[profile.profile_type]
      : "Non renseigné";

  async function copyId() {
    if (!user?.id) return;
    try {
      await navigator.clipboard.writeText(user.id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* En-tête */}
        <div className="flex flex-col gap-6 border-b border-neutral-200 pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-start gap-4">
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-xl font-bold text-white shadow-md"
              style={{ background: "linear-gradient(135deg, #F97316 0%, #EA580C 100%)" }}
              aria-hidden
            >
              {displayName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Profil</h1>
              <p className="mt-1 text-neutral-600">
                Vue d’ensemble de ton compte et de ton dossier sur Postuly.
              </p>
              {user?.email && (
                <p className="mt-2 flex items-center gap-2 text-sm text-neutral-500">
                  <Mail className="h-4 w-4 shrink-0" aria-hidden />
                  {user.email}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/cv"
              className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-800 shadow-sm transition hover:border-orange-200 hover:bg-orange-50/50"
            >
              <FileText className="h-4 w-4 text-orange-600" aria-hidden />
              Mon CV
              <ArrowRight className="h-4 w-4 text-neutral-400" aria-hidden />
            </Link>
            <Link
              href="/dashboard/parametres"
              className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-800 shadow-sm transition hover:border-orange-200 hover:bg-orange-50/50"
            >
              Paramètres
              <ArrowRight className="h-4 w-4 text-neutral-400" aria-hidden />
            </Link>
          </div>
        </div>

        {error && (
          <div
            className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            role="alert"
          >
            {error} Les infos de base (nom d’affichage ci-dessous) peuvent tout de même provenir de
            ta session.
          </div>
        )}

        {loading ? (
          <div className="mt-10 flex justify-center py-16">
            <div
              className="h-10 w-10 animate-spin rounded-full border-2 border-neutral-200 border-t-orange-500"
              aria-hidden
            />
            <span className="sr-only">Chargement du profil…</span>
          </div>
        ) : (
          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <Card title="Identité & compte" icon={UserRound}>
              <div className="space-y-4">
                <Row label="Nom affiché">{displayName}</Row>
                <Row label="Type de profil">{profileTypeLabel}</Row>
                <Row label="Membre depuis">
                  {formatDateFr(profile?.created_at ?? user?.created_at)}
                </Row>
                <Row label="Dernière connexion">
                  {formatDateTimeFr(user?.last_sign_in_at)}
                </Row>
              </div>
            </Card>

            <Card title="Dossier de candidature" icon={Briefcase}>
              <div className="space-y-4">
                <Row label="CV sur Postuly">
                  {profile?.cv_url ? (
                    <a
                      href={profile.cv_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-orange-600 underline-offset-2 hover:underline"
                    >
                      Ouvrir le fichier
                    </a>
                  ) : (
                    <span className="text-neutral-500">Aucun fichier enregistré</span>
                  )}
                </Row>
                <Row label="Score CV (IA)">
                  {profile?.cv_score != null ? (
                    <span className="inline-flex items-center gap-1.5 font-semibold tabular-nums text-orange-600">
                      <Sparkles className="h-4 w-4" aria-hidden />
                      {profile.cv_score}/100
                    </span>
                  ) : (
                    <span className="text-neutral-500">—</span>
                  )}
                </Row>
                <p className="text-xs leading-relaxed text-neutral-500">
                  Complète ou mets à jour ton CV depuis l’onglet{" "}
                  <Link href="/cv" className="font-medium text-orange-600 hover:underline">
                    Mon CV
                  </Link>{" "}
                  pour améliorer les conseils et les lettres générées.
                </p>
              </div>
            </Card>

            <Card title="Intégrations" icon={Mail}>
              <div className="space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm text-neutral-700">Gmail (envoi des candidatures)</span>
                  <span
                    className={cn(
                      "inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold",
                      gmail?.connected
                        ? "bg-green-100 text-green-800"
                        : "bg-neutral-100 text-neutral-600"
                    )}
                  >
                    {gmail?.connected ? "Connecté" : "Non connecté"}
                  </span>
                </div>
                {gmail?.connected && gmail.email && (
                  <p className="text-sm text-neutral-600">{gmail.email}</p>
                )}
                <Link
                  href="/settings"
                  className="inline-flex items-center gap-2 text-sm font-medium text-orange-600 hover:underline"
                >
                  {gmail?.connected ? "Gérer la connexion Gmail" : "Connecter Gmail"}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
            </Card>

            <Card title="Sécurité & technique" icon={Shield}>
              <div className="space-y-4">
                <Row label="Identifiant utilisateur (UUID)">
                  <div className="flex items-center justify-end gap-2">
                    <span className="max-w-[200px] truncate font-mono text-xs text-neutral-700 sm:max-w-none">
                      {user?.id ?? "—"}
                    </span>
                    <button
                      type="button"
                      onClick={() => void copyId()}
                      className="rounded-lg border border-neutral-200 p-1.5 text-neutral-500 transition hover:bg-neutral-50 hover:text-neutral-800"
                      title="Copier"
                    >
                      <Copy className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>
                </Row>
                {copied && (
                  <p className="text-xs text-green-600" role="status">
                    Copié dans le presse-papiers.
                  </p>
                )}
                <p className="text-xs leading-relaxed text-neutral-500">
                  Utile pour le support : ne partage cet identifiant que si on te le demande
                  explicitement.
                </p>
              </div>
            </Card>

            <Card title="Calendrier" icon={Calendar} className="lg:col-span-2">
              <p className="text-sm text-neutral-600">
                Les rappels de relance et l’historique détaillé des envois seront regroupés ici dans
                une prochaine version. En attendant, suis tes campagnes depuis le{" "}
                <Link href="/dashboard" className="font-medium text-orange-600 hover:underline">
                  tableau de bord
                </Link>{" "}
                et le{" "}
                <Link href="/kanban" className="font-medium text-orange-600 hover:underline">
                  Kanban
                </Link>
                .
              </p>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
