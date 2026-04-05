import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-01-27.acacia" as Stripe.LatestApiVersion,
});

export const PLANS = {
  starter: { priceId: "price_1THYEmPX3iTgAWOQm2vpH45i", name: "Starter", price: "24,99 €" },
  pro:     { priceId: "price_1THYHPPX3iTgAWOQIlFT64mL", name: "Pro",     price: "37,99 €" },
  max:     { priceId: "price_1THYIJPX3iTgAWOQPwSN3hZY", name: "Max",     price: "54,99 €" },
} as const;

export type PlanKey = keyof typeof PLANS;
