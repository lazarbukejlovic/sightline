"use server";

import { redirect } from "next/navigation";
import type { Route } from "next";
import type Stripe from "stripe";
import { z } from "zod";
import { requireOrgContext } from "@/lib/org/context";
import { hasAtLeast } from "@/lib/org-scope";
import { clientEnv, getServerEnv } from "@/lib/env";
import { getStripe, stripeConfigured } from "@/lib/billing/stripe";
import {
  ensureStripeCustomer,
  seatCount,
  getOrgSubscription,
} from "@/lib/billing/subscription";
import { logAudit } from "@/lib/audit";

const BILLING: Route = "/app/billing";

function withError(message: string): Route {
  return `/app/billing?error=${encodeURIComponent(message)}` as Route;
}

/**
 * Start Stripe Checkout for a paid plan (per-seat licensed price + the metered
 * AI-usage price). Owner/Admin only. Redirects to Stripe, or back with ?error.
 */
export async function startCheckout(formData: FormData): Promise<void> {
  const { user, orgId, role } = await requireOrgContext();
  if (!hasAtLeast(role, "admin")) {
    redirect(withError("Only owners and admins can manage billing."));
  }
  if (!stripeConfigured()) {
    redirect(withError("Billing is not configured."));
  }

  const planParsed = z.enum(["pro", "team"]).safeParse(formData.get("plan"));
  if (!planParsed.success) redirect(withError("Invalid plan."));
  const plan = planParsed.data;

  const env = getServerEnv();
  const priceId =
    plan === "pro" ? env.STRIPE_PRO_PRICE_ID : env.STRIPE_TEAM_PRICE_ID;
  if (!priceId) redirect(withError("That plan's price is not configured."));

  const customer = await ensureStripeCustomer(orgId, user.email ?? undefined);
  const seats = Math.max(1, await seatCount(orgId));

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    { price: priceId, quantity: seats },
  ];
  if (env.STRIPE_AI_USAGE_PRICE_ID) {
    // Metered usage price — no quantity (billed from reported meter events).
    lineItems.push({ price: env.STRIPE_AI_USAGE_PRICE_ID });
  }

  const base = clientEnv.NEXT_PUBLIC_SITE_URL;
  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    customer,
    line_items: lineItems,
    client_reference_id: orgId,
    subscription_data: { metadata: { orgId } },
    allow_promotion_codes: true,
    // session_id lets the success page reconcile immediately (not webhook-race).
    success_url: `${base}/app/billing?status=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/app/billing?status=cancel`,
  });

  if (!session.url) redirect(withError("Could not start checkout."));
  await logAudit({
    orgId,
    actorId: user.id,
    action: "billing.checkout.started",
    target: plan,
    metadata: { seats },
  });
  redirect(session.url as Route);
}

/** Open the Stripe Customer Portal to manage/cancel the subscription. */
export async function openPortal(): Promise<void> {
  const { orgId, role } = await requireOrgContext();
  if (!hasAtLeast(role, "admin")) {
    redirect(withError("Only owners and admins can manage billing."));
  }
  if (!stripeConfigured()) redirect(withError("Billing is not configured."));

  const sub = await getOrgSubscription(orgId);
  if (!sub?.stripeCustomerId) {
    redirect(withError("No billing account yet — choose a plan first."));
  }

  const base = clientEnv.NEXT_PUBLIC_SITE_URL;
  const portal = await getStripe().billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: `${base}${BILLING}`,
  });
  redirect(portal.url as Route);
}
