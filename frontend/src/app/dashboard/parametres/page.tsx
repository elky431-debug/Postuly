"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ExternalLink,
  LayoutDashboard,
  Lock,
  Mail,
  MapPin,
  Shield,
  UserRound,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { createClient } from "@/lib/supabase";
import { GmailIntegrationCard } from "@/components/settings/GmailIntegrationCard";
import { NotificationPreferencesCard } from "@/components/settings/NotificationPreferencesCard";

/**
 * Paramètres dashboard : compte, Gmail, notifications locales, confidentialité, raccourcis.
 */
export default function ParametresPage() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getSession().then(({ data: { session } }) => {
      setEmail(session?.user?.email ?? null);
    });
  }, []);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="border-b border-neutral-200 pb-8">
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Paramètres</h1>
          <p className="mt-1 text-neutral-600">
            Compte, envoi d&apos;e-mails, préférences et liens utiles.
          </p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {/* Compte */}
          <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm lg:col-span-2">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
                  <UserRound className="h-4 w-4" aria-hidden />
                </span>
                <h2 className="text-base font-semibold text-neutral-900">Compte</h2>
              </div>
              <Link
                href="/dashboard/profil"
                className="inline-flex items-center gap-1 text-sm font-medium text-orange-600 hover:underline"
              >
                Voir le profil complet
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                  E-mail de connexion
                </p>
                <p className="mt-1 text-sm text-neutral-900">{email ?? "—"}</p>
              </div>
              <p className="max-w-md text-xs text-neutral-500">
                Le mot de passe et la double authentification se gèrent via Supabase (lien
                ci-dessous si activé sur ton projet).
              </p>
            </div>
          </section>

          {/* Gmail — OAuth utilise /settings en callback ; la carte est identique */}
          <div className="lg:col-span-2">
            <Suspense
              fallback={
                <div className="rounded-2xl border border-neutral-200 bg-white p-6 text-sm text-neutral-500 shadow-sm">
                  Chargement des intégrations…
                </div>
              }
            >
              <GmailIntegrationCard />
            </Suspense>
          </div>

          <NotificationPreferencesCard />

          {/* Confidentialité */}
          <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2 border-b border-neutral-100 pb-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700">
                <Lock className="h-4 w-4" aria-hidden />
              </span>
              <h2 className="text-base font-semibold text-neutral-900">Données & confidentialité</h2>
            </div>
            <ul className="space-y-3 text-sm text-neutral-600">
              <li className="flex gap-2">
                <Shield className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
                <span>
                  Données hébergées sur Supabase (infrastructure compatible RGPD). Les clés API
                  sensibles restent côté serveur.
                </span>
              </li>
              <li className="flex gap-2">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
                <span>
                  L&apos;accès Gmail est limité aux scopes nécessaires à l&apos;envoi et à la lecture
                  basique ; tu peux révoquer l&apos;accès depuis ton compte Google.
                </span>
              </li>
            </ul>
          </section>

          {/* Raccourcis */}
          <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm lg:col-span-2">
            <div className="mb-4 flex items-center gap-2 border-b border-neutral-100 pb-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
                <MapPin className="h-4 w-4" aria-hidden />
              </span>
              <h2 className="text-base font-semibold text-neutral-900">Raccourcis</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Link
                href="/dashboard"
                className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50/80 px-4 py-3 text-sm font-medium text-neutral-800 transition hover:border-orange-200 hover:bg-orange-50/50"
              >
                <LayoutDashboard className="h-5 w-5 text-orange-600" aria-hidden />
                Tableau de bord
              </Link>
              <Link
                href="/dashboard/entreprises"
                className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50/80 px-4 py-3 text-sm font-medium text-neutral-800 transition hover:border-orange-200 hover:bg-orange-50/50"
              >
                Entreprises
              </Link>
              <Link
                href="/cv"
                className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50/80 px-4 py-3 text-sm font-medium text-neutral-800 transition hover:border-orange-200 hover:bg-orange-50/50"
              >
                Mon CV
              </Link>
              <Link
                href="/kanban"
                className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50/80 px-4 py-3 text-sm font-medium text-neutral-800 transition hover:border-orange-200 hover:bg-orange-50/50"
              >
                Kanban
              </Link>
            </div>
            <p className="mt-4 text-xs text-neutral-500">
              Vue alternative sans menu latéral :{" "}
              <Link href="/settings" className="font-medium text-orange-600 hover:underline">
                /settings
              </Link>
              .
            </p>
          </section>

          {/* À propos */}
          <section className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/50 p-5 text-center text-sm text-neutral-600 lg:col-span-2">
            <p>
              Postuly est en <strong className="text-neutral-800">bêta</strong>. Une question ou un
              bug ? Écris-nous depuis ton espace ou consulte la documentation du projet.
            </p>
            <a
              href="https://www.cnil.fr/fr/rgpd-quelles-sont-les-grandes-lignes-du-reglement"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-orange-600 hover:underline"
            >
              Rappel RGPD (CNIL)
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}
