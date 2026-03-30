"use client";

import { Suspense } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { GmailIntegrationCard } from "@/components/settings/GmailIntegrationCard";

export default function SettingsPage() {
  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl space-y-8 py-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Paramètres</h1>
          <p className="mt-1 text-sm text-gray-500">Compte et intégrations.</p>
        </div>
        <Suspense
          fallback={
            <div className="rounded-xl border border-neutral-200 bg-white p-6 text-sm text-neutral-500">
              Chargement…
            </div>
          }
        >
          <GmailIntegrationCard />
        </Suspense>
      </div>
    </AppLayout>
  );
}
