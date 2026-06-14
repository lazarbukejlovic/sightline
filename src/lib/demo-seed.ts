import type { PrismaClient } from "@prisma/client";

/**
 * Demo dataset of real public companies + realistic detected changes (with
 * redline diffs), so a reviewer sees the product's value immediately. Used by
 * the in-app "Load sample intel" onboarding action and the standalone
 * `prisma/seed-demo.mjs` demo-org script. Pure data + a DI'd seeder — no app
 * singletons — so it runs in either context.
 */

type Cat = "pricing" | "product" | "positioning" | "hiring" | "funding" | "other";
type Impact = "low" | "medium" | "high";
type SrcType = "pricing" | "changelog" | "blog" | "news" | "careers" | "custom";

interface DemoChange {
  sourceIndex: number;
  summary: string;
  whyItMatters: string;
  category: Cat;
  impact: Impact;
  confidence: number;
  diffExcerpt?: string;
}

interface DemoCompetitor {
  name: string;
  domain: string;
  sources: { type: SrcType; url: string }[];
  changes: DemoChange[];
}

export const DEMO_COMPETITORS: DemoCompetitor[] = [
  {
    name: "Vercel",
    domain: "vercel.com",
    sources: [
      { type: "pricing", url: "https://vercel.com/pricing" },
      { type: "changelog", url: "https://vercel.com/changelog" },
    ],
    changes: [
      {
        sourceIndex: 0,
        summary:
          "Reworked the Pro plan to usage-based pricing and removed the fixed per-seat cap, adding metered compute and bandwidth tiers.",
        whyItMatters:
          "Their entry cost is now harder to compare line-by-line — expect pricing objections in deals; refresh the pricing battlecard.",
        category: "pricing",
        impact: "high",
        confidence: 0.89,
        diffExcerpt:
          "- Pro — $20 / seat / month, includes fixed usage\n+ Pro — $20 / month base + usage-based compute & bandwidth\n+ Included: 1M edge requests, then metered",
      },
      {
        sourceIndex: 1,
        summary:
          "Shipped a redesigned observability dashboard and rolled out Fluid Compute to all plans.",
        whyItMatters:
          "Closes an observability gap RevOps buyers ask about — note it in the product-comparison card.",
        category: "product",
        impact: "medium",
        confidence: 0.76,
      },
    ],
  },
  {
    name: "Linear",
    domain: "linear.app",
    sources: [
      { type: "changelog", url: "https://linear.app/changelog" },
      { type: "careers", url: "https://linear.app/careers" },
    ],
    changes: [
      {
        sourceIndex: 0,
        summary:
          "Launched Linear Asks (intake from Slack) and a redesigned triage Inbox.",
        whyItMatters:
          "Moves them further into cross-team intake — overlaps with our workflow story; brief sales on the differentiation.",
        category: "product",
        impact: "medium",
        confidence: 0.72,
        diffExcerpt:
          "- Inbox: notifications\n+ Inbox: notifications, triage, and Asks intake\n+ New: Linear Asks — turn Slack messages into issues",
      },
      {
        sourceIndex: 1,
        summary:
          "Opened several go-to-market roles including a Head of Sales and two solutions engineers.",
        whyItMatters:
          "Signals a shift from pure PLG toward enterprise sales motion — watch for upmarket positioning.",
        category: "hiring",
        impact: "low",
        confidence: 0.63,
      },
    ],
  },
  {
    name: "Notion",
    domain: "notion.so",
    sources: [{ type: "pricing", url: "https://www.notion.so/pricing" }],
    changes: [
      {
        sourceIndex: 0,
        summary:
          "Bundled Notion AI into the Business plan at no additional per-seat cost.",
        whyItMatters:
          "Undercuts standalone AI add-on pricing — directly pressures our AI upsell; update the pricing counter.",
        category: "pricing",
        impact: "high",
        confidence: 0.84,
        diffExcerpt:
          "- Business — $15 / seat / mo · Notion AI +$8 / seat\n+ Business — $15 / seat / mo · Notion AI included\n+ Unlimited AI for Business and Enterprise",
      },
    ],
  },
  {
    name: "Stripe",
    domain: "stripe.com",
    sources: [{ type: "news", url: "https://stripe.com/newsroom" }],
    changes: [
      {
        // Low confidence on purpose → lands in the Review Queue, not the feed.
        sourceIndex: 0,
        summary:
          "Possible expansion of Stripe Tax to additional markets; figures unconfirmed across sources.",
        whyItMatters:
          "Low confidence — routed to the Review Queue for a human to verify before it reaches the feed.",
        category: "positioning",
        impact: "medium",
        confidence: 0.54,
      },
    ],
  },
];

/**
 * Seed the demo dataset into an org. Idempotent-ish by design: callers should
 * only run it on an org with no competitors. Returns the count created.
 */
export async function seedDemoData(
  prisma: PrismaClient,
  orgId: string,
): Promise<{ competitors: number; changes: number }> {
  let changeCount = 0;
  const now = Date.now();
  let i = 0;

  for (const c of DEMO_COMPETITORS) {
    const competitor = await prisma.competitor.create({
      data: { orgId, name: c.name, domain: c.domain },
      select: { id: true },
    });

    const sources = [];
    for (const s of c.sources) {
      const source = await prisma.source.create({
        data: {
          orgId,
          competitorId: competitor.id,
          type: s.type,
          url: s.url,
          lastScannedAt: new Date(now - 1000 * 60 * 60 * (6 + i)),
        },
        select: { id: true },
      });
      sources.push(source.id);
    }

    for (const ch of c.changes) {
      const lowConfidence = ch.confidence < 0.6;
      await prisma.change.create({
        data: {
          orgId,
          competitorId: competitor.id,
          sourceId: sources[ch.sourceIndex] ?? sources[0]!,
          summary: ch.summary,
          whyItMatters: ch.whyItMatters,
          category: ch.category,
          impact: ch.impact,
          confidence: ch.confidence,
          diffExcerpt: ch.diffExcerpt ?? null,
          status: lowConfidence ? "new" : "reviewed",
          detectedAt: new Date(now - 1000 * 60 * 60 * (2 + i * 3)),
        },
      });
      changeCount++;
      i++;
    }
  }

  return { competitors: DEMO_COMPETITORS.length, changes: changeCount };
}
