// Standalone demo-org seeder.
//
//   node --env-file=.env.local prisma/seed-demo.mjs
//
// Creates a "Sightline Demo" organization (slug: demo-workspace) populated with
// real public companies + realistic detected changes (incl. a low-confidence
// item that lands in the Review Queue), so the product shows value immediately
// for screenshots / a Loom walkthrough. Idempotent: skips if already seeded.
//
// Mirrors src/lib/demo-seed.ts (kept self-contained so it runs as plain Node
// without a TS runner). The in-app "Load sample intel" onboarding button seeds
// the signed-in user's own workspace using that TS module.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEMO = [
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
          "Their entry cost is now harder to compare line-by-line — expect pricing objections; refresh the pricing battlecard.",
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
          "Moves them further into cross-team intake — overlaps with our workflow story; brief sales.",
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
          "Signals a shift from pure PLG toward enterprise sales — watch for upmarket positioning.",
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
          "Undercuts standalone AI add-on pricing — directly pressures our AI upsell; update the counter.",
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

async function main() {
  const slug = "demo-workspace";
  let org = await prisma.organization.findUnique({ where: { slug } });
  if (!org) {
    org = await prisma.organization.create({
      data: { name: "Sightline Demo", slug },
    });
    console.log("Created demo org:", org.id);
  }

  const existing = await prisma.competitor.count({ where: { orgId: org.id } });
  if (existing > 0) {
    console.log(`Demo org already seeded (${existing} competitors). Nothing to do.`);
    return;
  }

  const now = Date.now();
  let i = 0;
  let changes = 0;

  for (const c of DEMO) {
    const competitor = await prisma.competitor.create({
      data: { orgId: org.id, name: c.name, domain: c.domain },
      select: { id: true },
    });
    const sources = [];
    for (const s of c.sources) {
      const src = await prisma.source.create({
        data: {
          orgId: org.id,
          competitorId: competitor.id,
          type: s.type,
          url: s.url,
          lastScannedAt: new Date(now - 1000 * 60 * 60 * (6 + i)),
        },
        select: { id: true },
      });
      sources.push(src.id);
    }
    for (const ch of c.changes) {
      const lowConfidence = ch.confidence < 0.6;
      await prisma.change.create({
        data: {
          orgId: org.id,
          competitorId: competitor.id,
          sourceId: sources[ch.sourceIndex] ?? sources[0],
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
      changes++;
      i++;
    }
  }

  console.log(`Seeded ${DEMO.length} competitors and ${changes} changes into ${org.id}.`);
  console.log("Note: this org has no members; attach one in the DB to log in, or");
  console.log("use the in-app 'Load sample intel' button to seed your own workspace.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
