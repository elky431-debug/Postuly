"use client";

import { Sparkles } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

/**
 * Page abonnement — placeholder MVP (offre à brancher plus tard).
 */
export default function AbonnementPage() {
  return (
    <DashboardLayout>
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Abonnement</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Gère ton offre Postuly dès qu&apos;elle sera disponible.
        </p>

        <div className="mt-8 rounded-xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-orange-100 text-orange-600">
            <Sparkles className="h-7 w-7" aria-hidden />
          </div>
          <p className="mt-4 font-semibold text-neutral-900">Phase Beta</p>
          <p className="mt-2 text-sm text-neutral-600">
            Tu utilises actuellement Postuly en accès gratuit pendant la bêta. Les offres payantes
            et la facturation seront ajoutées ici prochainement.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
