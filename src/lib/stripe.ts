// Stripe singleton. Throws on first use if STRIPE_SECRET_KEY is missing,
// not at import time, so the dev server boots cleanly when keys aren't set.

import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function stripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set in .env. Get one from https://dashboard.stripe.com/apikeys",
    );
  }
  _stripe = new Stripe(key, { apiVersion: "2025-01-27.acacia" as any });
  return _stripe;
}

export const AUDIT_PRICE_CENTS = 40000; // $400.00
export const AUDIT_PRICE_DISPLAY = "$400";
