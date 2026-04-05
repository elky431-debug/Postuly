"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, CreditCard, Loader2, Sparkles, X, Zap } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { createClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";

// ─── Config plans ──────────────────────────────────────────────────────────────

const PLANS = [
  {
    key:      "starter",
    name:     "Starter",
    price:    "24,99 €",
    features: ["Recherche entreprises", "Candidatures alternance", "Offres France Travail", "Génération lettre IA"],
  },
  {
    key:      "pro",
    name:     "Pro",
    price:    "37,99 €",
    popular:  true,
    features: ["Tout Starter", "Kanban candidatures", "Récupération emails (Hunter)", "CV parsing IA"],
  },
  {
    key:      "max",
    name:     "Max",
    price:    "54,99 €",
    features: ["Tout Pro", "Envoi emails automatisé", "Sélections avancées", "Support prioritaire"],
  },
] as const;

type PlanKey = "starter" | "pro" | "max";

// ─── Composant ────────────────────────────────────────────────────────────────

export default function AbonnementPage() {
  const searchParams = useSearchParams();
  const [token, setToken]       = useState("");
  const [currentPlan, setCurrentPlan] = useState<PlanKey | null>(null);
  const [subStatus, setSubStatus]     = useState<string | null>(null);
  const [loading, setLoading]         = useState(true);
  const [checkoutBusy, setCheckoutBusy] = useState<string | null>(null);
  const [portalBusy, setPortalBusy]     = useState(false);
  const [error, setError]               = useState<string | null>(null);

  const success  = searchParams.get("success") === "1";
  const canceled = searchParams.get("canceled") === "1";

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { setLoading(false); return; }
      setToken(session.access_token);

      // Lire le plan depuis Supabase (via profil)
      const { data: profile } = await supabase
        .from("profiles")
        .select("stripe_plan, stripe_subscription_status")
        .eq("id", session.user.id)
        .maybeSingle();

      setCurrentPlan((profile?.stripe_plan as PlanKey) ?? null);
      setSubStatus((profile?.stripe_subscription_status as string) ?? null);
      setLoading(false);
    });
  }, []);

  async function startCheckout(plan: string) {
    setCheckoutBusy(plan);
    setError(null);
    try {
      const res  = await fetch("/api/stripe/checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ plan }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "Erreur");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue");
      setCheckoutBusy(null);
    }
  }

  async function openPortal() {
    setPortalBusy(true);
    setError(null);
    try {
      const res  = await fetch("/api/stripe/portal", {
        method:  "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "Erreur");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue");
      setPortalBusy(false);
    }
  }

  const isActive = subStatus === "active" || subStatus === "trialing";

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl px-6 pb-16 pt-7">

        {/* Header */}
        <div className="mb-8 flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-100">
            <CreditCard className="h-6 w-6 text-orange-500" strokeWidth={2} />
          </div>
          <div>
            <h2 className="text-[18px] font-bold text-stone-900">Abonnement</h2>
            <p className="mt-0.5 text-[14px] text-stone-400">Gère ton offre Postuly.</p>
          </div>
        </div>

        {/* Toasts */}
        {success && (
          <div className="mb-6 flex items-center gap-3 rounded-xl bg-green-50 px-4 py-3 ring-1 ring-green-200">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />
            <p className="text-[13px] font-medium text-green-800">Paiement confirmé ! Ton abonnement est actif.</p>
          </div>
        )}
        {canceled && (
          <div className="mb-6 flex items-center gap-3 rounded-xl bg-stone-50 px-4 py-3 ring-1 ring-stone-200">
            <X className="h-4 w-4 shrink-0 text-stone-400" />
            <p className="text-[13px] text-stone-600">Paiement annulé.</p>
          </div>
        )}
        {error && (
          <div className="mb-6 rounded-xl bg-red-50 px-4 py-3 ring-1 ring-red-200">
            <p className="text-[13px] text-red-600">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-7 w-7 animate-spin text-orange-400" />
          </div>
        ) : (
          <>
            {/* Plan actuel */}
            {isActive && currentPlan && (
              <div className="mb-8 flex items-center justify-between rounded-2xl bg-orange-50 px-5 py-4 ring-1 ring-orange-200">
                <div className="flex items-center gap-3">
                  <Zap className="h-5 w-5 text-orange-500" strokeWidth={2} />
                  <div>
                    <p className="text-[13px] font-semibold text-stone-900">
                      Plan actif — Postuly {currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}
                    </p>
                    <p className="text-[11px] text-stone-500 capitalize">{subStatus}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={openPortal}
                  disabled={portalBusy}
                  className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-[12px] font-semibold text-stone-700 ring-1 ring-stone-200 transition hover:bg-stone-50 disabled:opacity-60"
                >
                  {portalBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Gérer / Résilier
                </button>
              </div>
            )}

            {/* Grille plans */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {PLANS.map((plan) => {
                const isCurrentPlan = currentPlan === plan.key && isActive;
                const busy          = checkoutBusy === plan.key;
                return (
                  <div
                    key={plan.key}
                    className={cn(
                      "relative flex flex-col rounded-2xl bg-white p-6 shadow-[0_2px_8px_rgba(0,0,0,0.05)] ring-1 transition-all",
                      plan.popular
                        ? "ring-orange-400 shadow-[0_4px_20px_rgba(249,115,22,0.15)]"
                        : "ring-stone-100",
                      isCurrentPlan && "ring-green-400"
                    )}
                  >
                    {plan.popular && !isCurrentPlan && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-orange-500 px-3 py-0.5 text-[10px] font-bold text-white">
                        Populaire
                      </span>
                    )}
                    {isCurrentPlan && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-green-500 px-3 py-0.5 text-[10px] font-bold text-white">
                        Plan actif
                      </span>
                    )}

                    <p className="text-[15px] font-bold text-stone-900">Postuly {plan.name}</p>
                    <p className="mt-1 text-[22px] font-extrabold text-stone-900">
                      {plan.price}
                      <span className="text-[13px] font-normal text-stone-400">/mois</span>
                    </p>

                    <ul className="mt-4 flex flex-col gap-2">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-[12px] text-stone-600">
                          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-400" strokeWidth={2} />
                          {f}
                        </li>
                      ))}
                    </ul>

                    <div className="mt-auto pt-5">
                      {isCurrentPlan ? (
                        <div className="flex items-center justify-center gap-2 rounded-xl bg-green-50 py-2.5 text-[12px] font-semibold text-green-700 ring-1 ring-green-200">
                          <CheckCircle2 className="h-4 w-4" />
                          Plan actuel
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startCheckout(plan.key)}
                          disabled={!!checkoutBusy}
                          className={cn(
                            "flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-[12px] font-semibold transition disabled:opacity-60",
                            plan.popular
                              ? "bg-orange-500 text-white hover:bg-orange-600"
                              : "bg-stone-900 text-white hover:bg-stone-800"
                          )}
                        >
                          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                          {isActive ? "Changer de plan" : "Choisir ce plan"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
