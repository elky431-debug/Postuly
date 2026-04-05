"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Loader2 } from "lucide-react";

const PLAN_LABELS: Record<string, string> = {
  starter: "Postuly Starter — 24,99 €/mois",
  pro:     "Postuly Pro — 37,99 €/mois",
  max:     "Postuly Max — 54,99 €/mois",
};

function CheckoutRedirect() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const plan         = searchParams.get("plan") ?? "";
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!plan || !(plan in PLAN_LABELS)) {
      router.replace("/dashboard/abonnement");
      return;
    }

    const supabase = createClient();
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace(`/auth/login?redirect=/checkout?plan=${plan}`);
        return;
      }

      try {
        const res  = await fetch("/api/stripe/checkout", {
          method:  "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization:  `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ plan }),
        });
        const data = await res.json() as { url?: string; error?: string };
        if (!res.ok || !data.url) throw new Error(data.error ?? "Erreur création session");
        window.location.href = data.url;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur inattendue");
      }
    })();
  }, [plan, router]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50">
        <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-stone-200 text-center max-w-sm">
          <p className="font-semibold text-red-600">Erreur</p>
          <p className="mt-2 text-sm text-stone-500">{error}</p>
          <a
            href="/dashboard/abonnement"
            className="mt-4 block text-sm text-orange-600 underline"
          >
            Retour aux offres
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50">
      <div className="text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-orange-500" />
        <p className="mt-4 text-[14px] text-stone-600">
          {plan in PLAN_LABELS
            ? `Redirection vers le paiement — ${PLAN_LABELS[plan]}`
            : "Redirection…"}
        </p>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-stone-50">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    }>
      <CheckoutRedirect />
    </Suspense>
  );
}
