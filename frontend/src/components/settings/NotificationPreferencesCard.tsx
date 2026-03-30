"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";

const STORAGE_KEY = "postuly-notification-prefs";

export type NotificationPrefs = {
  relances: boolean;
  digestHebdo: boolean;
  finCampagne: boolean;
};

const DEFAULTS: NotificationPrefs = {
  relances: true,
  digestHebdo: false,
  finCampagne: true,
};

/**
 * Préférences d’e-mail enregistrées localement (MVP — pas encore branché au backend).
 */
export function NotificationPreferencesCard() {
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULTS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<NotificationPrefs>;
        setPrefs({ ...DEFAULTS, ...parsed });
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      /* ignore */
    }
  }, [prefs, hydrated]);

  function toggle<K extends keyof NotificationPrefs>(key: K) {
    setPrefs((p) => ({ ...p, [key]: !p[key] }));
  }

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2 border-b border-neutral-100 pb-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
          <Bell className="h-4 w-4" aria-hidden />
        </span>
        <div>
          <h2 className="text-base font-semibold text-neutral-900">Notifications (e-mail)</h2>
          <p className="text-xs text-neutral-500">Indicatif — enregistré sur cet appareil</p>
        </div>
      </div>

      <ul className="space-y-4">
        <li className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-neutral-900">Rappels de relance</p>
            <p className="mt-0.5 text-xs text-neutral-500">
              Suggestions quand une candidature attend une relance.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={prefs.relances}
            onClick={() => toggle("relances")}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
              prefs.relances ? "bg-orange-500" : "bg-neutral-200"
            }`}
          >
            <span
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                prefs.relances ? "left-5" : "left-0.5"
              }`}
            />
          </button>
        </li>
        <li className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-neutral-900">Résumé hebdomadaire</p>
            <p className="mt-0.5 text-xs text-neutral-500">
              Synthèse des envois et réponses sur la semaine.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={prefs.digestHebdo}
            onClick={() => toggle("digestHebdo")}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
              prefs.digestHebdo ? "bg-orange-500" : "bg-neutral-200"
            }`}
          >
            <span
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                prefs.digestHebdo ? "left-5" : "left-0.5"
              }`}
            />
          </button>
        </li>
        <li className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-neutral-900">Fin de campagne</p>
            <p className="mt-0.5 text-xs text-neutral-500">
              Alerte lorsqu&apos;une campagne est terminée ou en pause.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={prefs.finCampagne}
            onClick={() => toggle("finCampagne")}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
              prefs.finCampagne ? "bg-orange-500" : "bg-neutral-200"
            }`}
          >
            <span
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                prefs.finCampagne ? "left-5" : "left-0.5"
              }`}
            />
          </button>
        </li>
      </ul>
    </section>
  );
}
