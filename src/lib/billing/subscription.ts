import "server-only";
import type Stripe from "stripe";
import { prisma } from "@/lib/db/prisma";
import { getServerEnv } from "@/lib/env";
import { getStripe, stripeConfigured } from "@/lib/billing/stripe";
import type { Plan } from "@/lib/billing/plans";

/** Subscription statuses we treat as entitling the paid plan. */
const ENTITLED = new Set(["active", "trialing", "past_due"]);

/**
 * The org's effective plan. Falls back to "free" when there is no subscription,
 * Stripe is unconfigured, or the subscription isn't in an entitling state.
 */
export async function getOrgPlan(orgId: string): Promise<Plan> {
  const sub = await prisma.subscription.findUnique({
    where: { orgId },
    select: { plan: true, status: true },
  });
  if (!sub || sub.plan === "free") return "free";
  return ENTITLED.has(sub.status) ? (sub.plan as Plan) : "free";
}

export async function getOrgSubscription(orgId: string) {
  return prisma.subscription.findUnique({ where: { orgId } });
}

/**
 * Set of org ids currently on a paid (pro/team) plan. Used to gate scheduled
 * monitoring + weekly digests (Free is manual-scan only).
 */
export async function paidOrgIds(): Promise<Set<string>> {
  const subs = await prisma.subscription.findMany({
    where: {
      plan: { in: ["pro", "team"] },
      status: { in: ["active", "trialing", "past_due"] },
    },
    select: { orgId: true },
  });
  return new Set(subs.map((s) => s.orgId));
}

/** Active seat count = number of memberships in the org. */
export async function seatCount(orgId: string): Promise<number> {
  return prisma.membership.count({ where: { orgId } });
}

/**
 * Get (or create) the Stripe customer for an org, persisting its id on the
 * subscription row. Customer metadata carries org_id for webhook resolution.
 */
export async function ensureStripeCustomer(
  orgId: string,
  email: string | undefined,
): Promise<string> {
  const existing = await prisma.subscription.findUnique({
    where: { orgId },
    select: { stripeCustomerId: true },
  });
  if (existing?.stripeCustomerId) return existing.stripeCustomerId;

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { name: true },
  });

  const customer = await getStripe().customers.create({
    email,
    name: org?.name ?? undefined,
    metadata: { orgId },
  });

  await prisma.subscription.upsert({
    where: { orgId },
    create: { orgId, stripeCustomerId: customer.id },
    update: { stripeCustomerId: customer.id },
  });
  return customer.id;
}

/** Map a Stripe subscription's licensed price id to our plan enum. */
function planFromSubscription(sub: Stripe.Subscription): Plan {
  const env = getServerEnv();
  for (const item of sub.items.data) {
    const priceId = item.price.id;
    if (priceId === env.STRIPE_PRO_PRICE_ID) return "pro";
    if (priceId === env.STRIPE_TEAM_PRICE_ID) return "team";
  }
  return "free";
}

function periodEnd(sub: Stripe.Subscription): Date | null {
  // current_period_end moved to the item level in recent API versions; read
  // defensively from either location.
  const item = sub.items.data[0] as unknown as { current_period_end?: number };
  const top = sub as unknown as { current_period_end?: number };
  const ts = item?.current_period_end ?? top.current_period_end;
  return ts ? new Date(ts * 1000) : null;
}

/**
 * Upsert our subscription row from a Stripe subscription (called by the
 * webhook). org_id comes from subscription metadata, set at checkout.
 */
export async function syncSubscriptionFromStripe(
  sub: Stripe.Subscription,
): Promise<void> {
  const orgId = sub.metadata?.orgId;
  if (!orgId) {
    console.warn(`Stripe subscription ${sub.id} has no orgId metadata; skipping`);
    return;
  }

  const plan = planFromSubscription(sub);
  // Seats = quantity of the licensed (non-metered) item.
  const env = getServerEnv();
  const licensed = sub.items.data.find(
    (i) =>
      i.price.id === env.STRIPE_PRO_PRICE_ID ||
      i.price.id === env.STRIPE_TEAM_PRICE_ID,
  );
  const seats = licensed?.quantity ?? 1;
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  const status = sub.status === "canceled" ? "canceled" : sub.status;
  const effectivePlan = status === "canceled" ? "free" : plan;

  await prisma.subscription.upsert({
    where: { orgId },
    create: {
      orgId,
      plan: effectivePlan,
      status,
      seats,
      stripeCustomerId: customerId,
      stripeSubscriptionId: sub.id,
      currentPeriodEnd: periodEnd(sub),
    },
    update: {
      plan: effectivePlan,
      status,
      seats,
      stripeCustomerId: customerId,
      stripeSubscriptionId: sub.id,
      currentPeriodEnd: periodEnd(sub),
    },
  });
}

/**
 * Reconcile a just-completed Checkout session synchronously (don't wait for the
 * webhook). Retrieves the session + its subscription and upserts our row, so the
 * plan flips immediately on the success page. Verifies the session belongs to
 * this org. Best-effort + idempotent — the webhook still handles later changes.
 */
export async function reconcileCheckoutSession(
  orgId: string,
  sessionId: string,
): Promise<void> {
  if (!stripeConfigured()) return;
  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Only honor a session that belongs to this org.
    const sessionOrg =
      session.client_reference_id ?? session.metadata?.orgId ?? null;
    if (sessionOrg && sessionOrg !== orgId) return;
    if (!session.subscription) return;

    const subId =
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription.id;
    const sub = await stripe.subscriptions.retrieve(subId);
    if (!sub.metadata?.orgId) {
      // Ensure downstream sync can resolve the org.
      sub.metadata = { ...sub.metadata, orgId };
    }
    await syncSubscriptionFromStripe(sub);
  } catch (err) {
    console.warn("reconcileCheckoutSession skipped (non-fatal):", err);
  }
}

/**
 * Best-effort: report one unit of metered AI usage to Stripe. Fully guarded —
 * never throws, never blocks the AI response. No-op unless Stripe + the usage
 * price are configured and the org has a Stripe customer.
 */
export async function reportAiUsage(orgId: string): Promise<void> {
  try {
    const env = getServerEnv();
    if (!stripeConfigured() || !env.STRIPE_AI_USAGE_PRICE_ID) return;

    const sub = await prisma.subscription.findUnique({
      where: { orgId },
      select: { stripeCustomerId: true },
    });
    if (!sub?.stripeCustomerId) return;

    await getStripe().billing.meterEvents.create({
      event_name: env.STRIPE_AI_USAGE_METER_EVENT,
      payload: { stripe_customer_id: sub.stripeCustomerId, value: "1" },
    });
  } catch (err) {
    console.warn("reportAiUsage skipped (non-fatal):", err);
  }
}
