import { type NextRequest } from "next/server";
import type Stripe from "stripe";
import { getStripe, stripeConfigured } from "@/lib/billing/stripe";
import { getServerEnv } from "@/lib/env";
import { syncSubscriptionFromStripe } from "@/lib/billing/subscription";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe webhook (TEST mode). Verifies the signature with STRIPE_WEBHOOK_SECRET,
 * then syncs subscription + seat state into the `subscriptions` table. Forward
 * locally with: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.
 */
export async function POST(req: NextRequest) {
  if (!stripeConfigured()) {
    return new Response("Billing is not configured.", { status: 200 });
  }
  const secret = getServerEnv().STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return new Response("Webhook secret not configured.", { status: 500 });
  }

  const body = await req.text(); // raw body required for signature verification
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing signature.", { status: 400 });

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "invalid";
    return new Response(`Invalid signature: ${msg}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.subscription) {
          const subId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription.id;
          const sub = await stripe.subscriptions.retrieve(subId);
          // Ensure org_id metadata is on the subscription (fallback to the
          // session's metadata / client_reference_id set at checkout).
          const orgId =
            sub.metadata?.orgId ??
            session.metadata?.orgId ??
            session.client_reference_id ??
            undefined;
          if (orgId && !sub.metadata?.orgId) {
            await stripe.subscriptions.update(sub.id, { metadata: { orgId } });
            sub.metadata = { ...sub.metadata, orgId };
          }
          await syncSubscriptionFromStripe(sub);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await syncSubscriptionFromStripe(event.data.object as Stripe.Subscription);
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error("Stripe webhook handler error:", err);
    return new Response("Handler error", { status: 500 });
  }

  return new Response("ok", { status: 200 });
}
