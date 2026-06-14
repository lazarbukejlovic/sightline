import type { Metadata, Route } from "next";
import Link from "next/link";
import { Radar, Link2, Activity } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { requireOrgContext } from "@/lib/org/context";
import { ChangeCard, type ChangeCardData } from "@/components/change-card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { initials, relativeTime, displayHost } from "@/lib/format";
import { REVIEW_CONFIDENCE_THRESHOLD } from "@/lib/constants";
import { AddCompetitorForm } from "./_components/add-competitor-form";
import { AskSightline } from "./_components/ask-sightline";
import { LoadSampleIntel } from "./_components/load-sample-intel";

export const metadata: Metadata = { title: "Intel Feed · Sightline" };
export const dynamic = "force-dynamic";

export default async function WorkspacePage() {
  const { user, orgId } = await requireOrgContext();

  const [competitors, changes, cost] = await Promise.all([
    prisma.competitor.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { sources: true, changes: true } } },
    }),
    prisma.change.findMany({
      // Feed = not dismissed, and either confident enough or already reviewed.
      // Low-confidence, still-new items live in the Review Queue instead.
      where: {
        orgId,
        status: { not: "dismissed" },
        OR: [
          { confidence: { gte: REVIEW_CONFIDENCE_THRESHOLD } },
          { status: { in: ["reviewed", "promoted"] } },
        ],
      },
      orderBy: { detectedAt: "desc" },
      take: 25,
      include: {
        competitor: { select: { name: true } },
        source: { select: { url: true } },
      },
    }),
    prisma.aiRun.aggregate({ where: { orgId }, _sum: { costUsd: true } }),
  ]);

  // The current user's feedback on the shown changes (to pre-fill thumbs).
  const myFeedback = await prisma.aiFeedback.findMany({
    where: {
      orgId,
      userId: user.id,
      changeId: { in: changes.map((c) => c.id) },
    },
    select: { changeId: true, rating: true },
  });
  const ratingByChange = new Map(
    myFeedback.map((f) => [f.changeId, f.rating] as const),
  );

  const feed: ChangeCardData[] = changes.map((ch) => ({
    competitor: ch.competitor.name,
    initials: initials(ch.competitor.name),
    category: ch.category,
    impact: ch.impact,
    confidence: ch.confidence,
    summary: ch.summary,
    whyItMatters: ch.whyItMatters,
    source: displayHost(ch.source.url),
    detectedAt: relativeTime(ch.detectedAt),
    diff: ch.diffExcerpt,
    feedbackChangeId: ch.id,
    feedbackRating: ratingByChange.get(ch.id) ?? null,
  }));

  const totalCost = Number(cost._sum.costUsd ?? 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)_340px]">
      {/* Left — competitors */}
      <aside className="flex flex-col gap-5">
        <div>
          <p className="font-meta text-xs uppercase tracking-wider text-signal">
            Competitors
          </p>
          <h2 className="mt-1 font-display text-2xl tracking-tight">
            Your watchlist
          </h2>
        </div>

        {competitors.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No competitors yet. Add your first below to start monitoring.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {competitors.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/app/competitors/${c.id}` as Route}
                  className="group flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 transition-colors hover:border-ink/20 hover:bg-secondary/60"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-secondary font-meta text-[11px] font-semibold">
                      {initials(c.name)}
                    </span>
                    <span className="truncate font-medium">{c.name}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2 font-meta text-[11px] tabular-nums text-muted-foreground">
                    <span
                      className="flex items-center gap-1"
                      title={`${c._count.sources} source${c._count.sources === 1 ? "" : "s"}`}
                    >
                      <Link2 className="size-3" strokeWidth={1.75} />
                      {c._count.sources}
                    </span>
                    <span
                      className={cn(
                        "flex items-center gap-1",
                        c._count.changes > 0 && "text-signal",
                      )}
                      title={`${c._count.changes} change${c._count.changes === 1 ? "" : "s"} detected`}
                    >
                      <Activity className="size-3" strokeWidth={1.75} />
                      {c._count.changes}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <h3 className="mb-3 font-display text-base">Add a competitor</h3>
          <AddCompetitorForm />
        </div>
      </aside>

      {/* Center — Intel Feed */}
      <section className="flex flex-col gap-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="font-meta text-xs uppercase tracking-wider text-signal">
              Intel Feed
            </p>
            <h1 className="mt-1 font-display text-3xl tracking-tight">
              What changed
            </h1>
          </div>
          <div className="flex items-center gap-2 font-meta text-xs tabular-nums text-muted-foreground">
            <span>{changes.length} recent</span>
            <span className="text-border">·</span>
            <span title="Total AI spend for this org">${totalCost.toFixed(4)} spent</span>
          </div>
        </div>

        {feed.length === 0 ? (
          <EmptyState
            icon={Radar}
            title="No signal yet"
            description="Add a competitor, point Sightline at a public page — pricing, changelog, blog, news, careers — and run a scan. Meaningful changes land here with cited evidence, an impact rating, and a confidence score. New here? Load sample intel to see it in action."
            hint="Awaiting first scan"
          >
            <LoadSampleIntel />
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-4">
            {feed.map((data, i) => (
              <ChangeCard key={changes[i]!.id} data={data} index={i} />
            ))}
          </div>
        )}
      </section>

      {/* Right — Ask Sightline */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <AskSightline />
      </aside>
    </div>
  );
}
