import { NextRequest, NextResponse } from "next/server";
import { stripe, PLANS, type PlanKey } from "@/lib/stripe";
import { getUserFromRequest } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer /i, "");
  const user  = await getUserFromRequest(token);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { plan } = (await req.json()) as { plan?: string };
  if (!plan || !(plan in PLANS)) {
    return NextResponse.json({ error: "Plan invalide" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("stripe_customer_id, full_name")
    .eq("id", user.id)
    .maybeSingle();

  let customerId = (profile?.stripe_customer_id as string | undefined) ?? undefined;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email:    user.email,
      name:     (profile?.full_name as string | undefined) ?? undefined,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;
    await admin.from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);
  }

  const origin = req.headers.get("origin") ?? "https://jobaddict.netlify.app";

  const session = await stripe.checkout.sessions.create({
    customer:   customerId,
    mode:       "subscription",
    line_items: [{ price: PLANS[plan as PlanKey].priceId, quantity: 1 }],
    success_url: `${origin}/dashboard/abonnement?success=1&plan=${plan}`,
    cancel_url:  `${origin}/dashboard/abonnement?canceled=1`,
    metadata:    { supabase_user_id: user.id, plan },
  });

  return NextResponse.json({ url: session.url });
}
