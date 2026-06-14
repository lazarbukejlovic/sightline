import "server-only";
import Stripe from "stripe";
import { getServerEnv } from "@/lib/env";

let client: Stripe | null = null;

/** Whether billing is configured (a Stripe secret key is present). */
export function stripeConfigured(): boolean {
  return Boolean(getServerEnv().STRIPE_SECRET_KEY);
}

/** Server-only Stripe client (TEST mode). Never sent to the browser. */
export function getStripe(): Stripe {
  const key = getServerEnv().STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("Stripe is not configured (STRIPE_SECRET_KEY unset).");
  }
  if (!client) {
    // Pin to the SDK's bundled API version (omit apiVersion → SDK default).
    client = new Stripe(key);
  }
  return client;
}
