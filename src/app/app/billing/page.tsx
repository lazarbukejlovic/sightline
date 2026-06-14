import type { Metadata } from "next";
import { prisma } from "@/lib/db/prisma";
import { requireOrgContext } from "@/lib/org/context";
import {
  getOrgPlan,
  getOrgSubscription,
  seatCount,
  reconcileCheckoutSession,
} from "@/lib/billing/subscription";
import { stripeConfigured } from "@/lib/billing/stripe";
import { PLAN_LABEL, PLAN_LIMITS, type Plan } from "@/lib/billing/plans";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Callout } from "@/components/ui/callout";
import { startCheckout, openPortal } from "./actions";

export const metadata: Metadata = { title: "Billing & usage · Sightline" };
export const dynamic = "force-dynamic";

const RUN_TYPE_LABEL: Record<string, string> = {
  ask: "Ask answers",
  change_analyze: "Change analysis",
  embed: "Embeddings",
  digest: "Digests",
  battlecard_suggest: "Battlecard drafts",
};

function usd(n: number): string {
  return `$${n.toFixed(n < 1 ? 4 : 2)}`;
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    error?: string;
    upgrade?: string;
    session_id?: string;
  }>;
}) {
  const { orgId, role } = await requireOrgContext();
  const sp = await searchParams;
  const billingOn = stripeConfigured();
  const canManage = role === "owner" || role === "admin";

  // On return from Checkout, sync the subscription immediately so the plan
  // flips without waiting for the webhook (which handles later changes).
  if (sp.status === "success" && sp.session_id) {
    await reconcileCheckoutSession(orgId, sp.session_id);
  }

  const [plan, sub, seats, runGroups, totalAgg, fbTotal, fbUp, askAgg] =
    await Promise.all([
      getOrgPlan(orgId),
      getOrgSubscription(orgId),
      seatCount(orgId),
      prisma.aiRun.groupBy({
        by: ["type"],
        where: { orgId },
        _count: { _all: true },
        _sum: { costUsd: true, inputTokens: true, outputTokens: true },
        _avg: { latencyMs: true },
      }),
      prisma.aiRun.aggregate({
        where: { orgId },
        _sum: { costUsd: true },
        _count: { _all: true },
      }),
      prisma.aiFeedback.count({ where: { orgId } }),
      prisma.aiFeedback.count({ where: { orgId, rating: "up" } }),
      prisma.aiRun.aggregate({
        where: { orgId, type: "ask" },
        _sum: { costUsd: true },
        _count: { _all: true },
      }),
    ]);

  const totalSpend = Number(totalAgg._sum.costUsd ?? 0);
  const askCount = askAgg._count._all;
  const costPerAnswer = askCount > 0 ? Number(askAgg._sum.costUsd ?? 0) / askCount : 0;
  const acceptanceRate = fbTotal > 0 ? Math.round((fbUp / fbTotal) * 100) : null;

  const paidPlans: { plan: Exclude<Plan, "free">; blurb: string }[] = [
    { plan: "pro", blurb: "Scheduled monitoring, battlecards, digests, RAG." },
    { plan: "team", blurb: "Everything in Pro + unlimited competitors." },
  ];

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <header>
        <p className="rule-eyebrow text-[10px] text-signal">Business</p>
        <h1 className="mt-1 font-display text-3xl tracking-tight">
          Billing &amp; usage
        </h1>
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">
          Manage your plan and seats, and see exactly what AI is costing — every
          answer is logged, priced, and measured.
        </p>
      </header>

      {sp.status === "success" && (
        <Callout tone="success">
          Subscription active — your plan is updated below.
        </Callout>
      )}
      {sp.status === "cancel" && (
        <Callout tone="info">Checkout canceled — no changes made.</Callout>
      )}
      {sp.upgrade === "battlecards" && (
        <Callout tone="info">
          Collaborative battlecards are a Pro feature. Upgrade below to unlock
          them.
        </Callout>
      )}
      {sp.error && <Callout tone="error">{sp.error}</Callout>}

      {/* ── Plan ─────────────────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <h2 className="font-display text-2xl tracking-tight">Plan</h2>
          <span className="flex items-center gap-2">
            <Badge variant={plan === "free" ? "secondary" : "teal"}>
              {PLAN_LABEL[plan]}
            </Badge>
            {sub?.status && sub.status !== "none" && (
              <span className="font-meta text-[11px] text-muted-foreground">
                {sub.status}
              </span>
            )}
          </span>
        </div>

        {!billingOn ? (
          <Callout tone="info">
            Billing isn&apos;t configured (no Stripe test key). Every org runs on
            the Free plan. Set <span className="font-meta">STRIPE_SECRET_KEY</span>{" "}
            (test mode) to enable upgrades.
          </Callout>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            {/* Free */}
            <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg">Free</h3>
                {plan === "free" && <Badge variant="teal">Current</Badge>}
              </div>
              <p className="font-meta text-[11px] text-muted-foreground">
                1 competitor · manual scans
              </p>
            </div>

            {/* Paid */}
            {paidPlans.map(({ plan: p, blurb }) => {
              const isCurrent = plan === p;
              const limit = PLAN_LIMITS[p].competitors;
              return (
                <div
                  key={p}
                  className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-lg">{PLAN_LABEL[p]}</h3>
                    {isCurrent && <Badge variant="teal">Current</Badge>}
                  </div>
                  <p className="font-meta text-[11px] text-muted-foreground">
                    {Number.isFinite(limit) ? `${limit} competitors` : "unlimited"}{" "}
                    · per seat + metered AI
                  </p>
                  <p className="text-xs text-muted-foreground">{blurb}</p>
                  {canManage && !isCurrent && (
                    <form action={startCheckout} className="mt-1">
                      <input type="hidden" name="plan" value={p} />
                      <Button
                        type="submit"
                        size="sm"
                        variant={p === "pro" ? "signal" : "outline"}
                        className="w-full"
                      >
                        Upgrade to {PLAN_LABEL[p]}
                      </Button>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {billingOn && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-secondary/30 px-4 py-3">
            <span className="font-meta text-xs tabular-nums text-muted-foreground">
              {seats} seat{seats === 1 ? "" : "s"}
              {sub?.currentPeriodEnd
                ? ` · renews ${sub.currentPeriodEnd.toLocaleDateString()}`
                : ""}
            </span>
            {canManage && plan !== "free" && (
              <form action={openPortal}>
                <Button type="submit" size="sm" variant="outline">
                  Manage billing →
                </Button>
              </form>
            )}
            {!canManage && (
              <span className="font-meta text-[11px] text-muted-foreground">
                Ask an owner/admin to change the plan.
              </span>
            )}
          </div>
        )}
      </section>

      {/* ── AI cost dashboard ────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <h2 className="border-b border-border pb-2 font-display text-2xl tracking-tight">
          AI cost &amp; usage
        </h2>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Total AI spend", value: usd(totalSpend) },
            { label: "AI calls", value: totalAgg._count._all.toLocaleString() },
            { label: "Ask answers", value: askCount.toLocaleString() },
            { label: "Cost / answer", value: usd(costPerAnswer) },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-border bg-card p-4 shadow-sm"
            >
              <p className="rule-eyebrow text-[9px] text-muted-foreground">
                {s.label}
              </p>
              <p className="mt-1 font-display text-2xl tabular-nums leading-tight">
                {s.value}
              </p>
            </div>
          ))}
        </div>

        <div className="overflow-x-auto rounded-xl border border-border shadow-sm">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b-2 border-ink/15 bg-secondary/60">
                {["Run type", "Calls", "Tokens", "Avg latency", "Cost"].map((h) => (
                  <th
                    key={h}
                    className="px-3.5 py-2.5 font-meta text-[10px] uppercase tracking-[0.12em] text-muted-foreground"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {runGroups.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3.5 py-6 text-center font-meta text-xs text-muted-foreground"
                  >
                    No AI runs yet — scan a source or ask a question.
                  </td>
                </tr>
              ) : (
                runGroups.map((g) => {
                  const tokens =
                    (g._sum.inputTokens ?? 0) + (g._sum.outputTokens ?? 0);
                  return (
                    <tr
                      key={g.type}
                      className="border-b border-border/60 last:border-0 odd:bg-secondary/20"
                    >
                      <td className="px-3.5 py-2">
                        {RUN_TYPE_LABEL[g.type] ?? g.type}
                      </td>
                      <td className="px-3.5 py-2 font-meta tabular-nums">
                        {g._count._all.toLocaleString()}
                      </td>
                      <td className="px-3.5 py-2 font-meta tabular-nums">
                        {tokens.toLocaleString()}
                      </td>
                      <td className="px-3.5 py-2 font-meta tabular-nums">
                        {Math.round(g._avg.latencyMs ?? 0)} ms
                      </td>
                      <td className="px-3.5 py-2 font-meta tabular-nums">
                        {usd(Number(g._sum.costUsd ?? 0))}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Answer quality (eval loop) ───────────────────────── */}
      <section className="flex flex-col gap-4">
        <h2 className="border-b border-border pb-2 font-display text-2xl tracking-tight">
          Answer quality
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="rule-eyebrow text-[9px] text-muted-foreground">
              Acceptance rate
            </p>
            <p className="mt-1 font-display text-3xl tabular-nums leading-tight text-teal">
              {acceptanceRate === null ? "—" : `${acceptanceRate}%`}
            </p>
            <p className="mt-1 font-meta text-[11px] text-muted-foreground">
              thumbs-up share of rated AI output
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="rule-eyebrow text-[9px] text-muted-foreground">
              Ratings collected
            </p>
            <p className="mt-1 font-display text-3xl tabular-nums leading-tight">
              {fbTotal.toLocaleString()}
            </p>
            <p className="mt-1 font-meta text-[11px] text-muted-foreground">
              {fbUp} up · {fbTotal - fbUp} down
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="rule-eyebrow text-[9px] text-muted-foreground">
              How it&apos;s used
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Thumbs + corrections on answers and change summaries feed the eval
              loop. Low confidence already routes to the Review Queue before
              reaching the feed.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
