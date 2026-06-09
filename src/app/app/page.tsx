import type { Metadata, Route } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { requireOrgContext } from "@/lib/org/context";
import { ChangeCard, type ChangeCardData } from "@/components/change-card";
import { initials, relativeTime, displayHost } from "@/lib/format";
import { AddCompetitorForm } from "./_components/add-competitor-form";
import { AskSightline } from "./_components/ask-sightline";

export const metadata: Metadata = { title: "Intel Feed · Sightline" };
export const dynamic = "force-dynamic";

export default async function WorkspacePage() {
  const { orgId } = await requireOrgContext();

  const [competitors, changes, cost] = await Promise.all([
    prisma.competitor.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { sources: true, changes: true } } },
    }),
    prisma.change.findMany({
      where: { orgId },
      orderBy: { detectedAt: "desc" },
      take: 25,
      include: {
        competitor: { select: { name: true } },
        source: { select: { url: true } },
      },
    }),
    prisma.aiRun.aggregate({ where: { orgId }, _sum: { costUsd: true } }),
  ]);

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
                  className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 transition-colors hover:bg-secondary/60"
                >
                  <span className="flex items-center gap-2.5">
                    <span className="flex size-7 items-center justify-center rounded-md bg-secondary font-meta text-[11px] font-semibold">
                      {initials(c.name)}
                    </span>
                    <span className="font-medium">{c.name}</span>
                  </span>
                  <span className="font-meta text-xs text-muted-foreground">
                    {c._count.sources}s · {c._count.changes}c
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
          <span className="font-meta text-xs text-muted-foreground">
            {changes.length} recent · ${totalCost.toFixed(4)} AI spend
          </span>
        </div>

        {feed.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-secondary/30 p-8 text-center">
            <h2 className="font-display text-2xl">Your Intel Feed is empty</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Add a competitor, point Sightline at a public page (pricing,
              changelog, blog, news, careers), and run a scan. Detected changes
              appear here with a citation and confidence score.
            </p>
          </div>
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
