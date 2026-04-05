import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import type Stripe from "stripe";

export const runtime = "nodejs";

// Stripe requires the raw body — disable Next.js body parsing
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body   = await req.text();
  const sig    = req.headers.get("stripe-signature") ?? "";
  const secret = process.env.STRIPE_WEBHOOK_SECRET ?? "";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const admin = createAdminClient();

  // ── Paiement réussi ───────────────────────────────────────────────────────
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId  = session.metadata?.supabase_user_id;
    const plan    = session.metadata?.plan;
    const subId   = session.subscription as string;

    if (userId && plan) {
      await admin.from("profiles").update({
        stripe_plan:                plan,
        stripe_subscription_id:     subId,
        stripe_subscription_status: "active",
      }).eq("id", userId);
    }
  }

  // ── Mise à jour ou résiliation abonnement ─────────────────────────────────
  if (
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const sub      = event.data.object as Stripe.Subscription;
    const updates: Record<string, unknown> = {
      stripe_subscription_status: sub.status,
    };
    if (event.type === "customer.subscription.deleted") {
      updates.stripe_plan            = null;
      updates.stripe_subscription_id = null;
    }

    // Retrouver l'utilisateur via metadata ou customer_id
    const userId = sub.metadata?.supabase_user_id;
    if (userId) {
      await admin.from("profiles").update(updates).eq("id", userId);
    } else {
      await admin.from("profiles").update(updates).eq("stripe_customer_id", sub.customer as string);
    }
  }

  return NextResponse.json({ received: true });
}
