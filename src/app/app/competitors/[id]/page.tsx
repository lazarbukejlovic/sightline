import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireOrgContext } from "@/lib/org/context";
import { ChangeCard, type ChangeCardData } from "@/components/change-card";
import { initials, relativeTime, displayHost } from "@/lib/format";
import { REVIEW_CONFIDENCE_THRESHOLD } from "@/lib/constants";
import { AddSourceForm } from "@/app/app/_components/add-source-form";
import { ScanButton } from "@/app/app/_components/scan-button";
import { AskSightline } from "@/app/app/_components/ask-sightline";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Activity } from "lucide-react";
import { openBattlecard } from "@/app/app/actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { orgId } = await requireOrgContext();
  const competitor = await prisma.competitor.findFirst({
    where: { id, orgId },
    select: { name: true },
  });
  return { title: competitor ? `${competitor.name} · Sightline` : "Sightline" };
}

export default async function CompetitorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { orgId } = await requireOrgContext();

  const competitor = await prisma.competitor.findFirst({
    where: { id, orgId },
    include: {
      sources: {
        orderBy: { createdAt: "asc" },
        include: { _count: { select: { snapshots: true } } },
      },
    },
  });
  if (!competitor) notFound();

  const [changes, totalChanges, highImpactCount] = await Promise.all([
    prisma.change.findMany({
      where: {
        orgId,
        competitorId: competitor.id,
        status: { not: "dismissed" },
        OR: [
          { confidence: { gte: REVIEW_CONFIDENCE_THRESHOLD } },
          { status: { in: ["reviewed", "promoted"] } },
        ],
      },
      orderBy: { detectedAt: "desc" },
      take: 25,
      include: { source: { select: { url: true } } },
    }),
    prisma.change.count({ where: { orgId, competitorId: competitor.id } }),
    prisma.change.count({
      where: {
        orgId,
        competitorId: competitor.id,
        impact: "high",
        status: { not: "dismissed" },
      },
    }),
  ]);

  const lastScanned = competitor.sources.reduce<Date | null>((acc, s) => {
    if (!s.lastScannedAt) return acc;
    return !acc || s.lastScannedAt > acc ? s.lastScannedAt : acc;
  }, null);

  const feed: ChangeCardData[] = changes.map((ch) => ({
    competitor: competitor.name,
    initials: initials(competitor.name),
    category: ch.category,
    impact: ch.impact,
    confidence: ch.confidence,
    summary: ch.summary,
    whyItMatters: ch.whyItMatters,
    source: displayHost(ch.source.url),
    detectedAt: relativeTime(ch.detectedAt),
    diff: ch.diffExcerpt,
  }));

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/app"
        className="font-meta text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
      >
        ← Intel Feed
      </Link>

      {/* Briefing dossier header */}
      <header className="relative overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div aria-hidden className="h-0.5 w-full bg-signal" />
        <div
          aria-hidden
          className="dossier-grid pointer-events-none absolute inset-0 opacity-[0.35]"
        />
        <div className="relative flex flex-col gap-5 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3.5">
              <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-secondary font-display text-xl ring-1 ring-inset ring-signal/15">
                {initials(competitor.name)}
              </span>
              <div className="min-w-0">
                <p className="rule-eyebrow text-[10px] text-muted-foreground">
                  Competitor dossier
                </p>
                <h1 className="mt-0.5 font-display text-4xl tracking-tight [overflow-wrap:anywhere]">
                  {competitor.name}
                </h1>
                {competitor.domain && (
                  <a
                    href={`https://${competitor.domain}`}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate font-meta text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                  >
                    {competitor.domain}
                  </a>
                )}
              </div>
            </div>
            <form action={openBattlecard} className="shrink-0">
              <input type="hidden" name="competitorId" value={competitor.id} />
              <Button type="submit" variant="outline" size="sm">
                Open battlecard →
              </Button>
            </form>
          </div>

          {/* stat grid */}
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4">
            <div className="bg-card px-3 py-2.5">
              <p className="rule-eyebrow text-[9px] text-muted-foreground">Sources</p>
              <p className="font-display text-2xl tabular-nums leading-tight">
                {competitor.sources.length}
              </p>
            </div>
            <div className="bg-card px-3 py-2.5">
              <p className="rule-eyebrow text-[9px] text-muted-foreground">Changes</p>
              <p className="font-display text-2xl tabular-nums leading-tight">
                {totalChanges}
              </p>
            </div>
            <div className="bg-card px-3 py-2.5">
              <p className="rule-eyebrow text-[9px] text-muted-foreground">
                High-impact
              </p>
              <p
                className={`font-display text-2xl tabular-nums leading-tight ${highImpactCount > 0 ? "text-signal" : ""}`}
              >
                {highImpactCount}
              </p>
            </div>
            <div className="bg-card px-3 py-2.5">
              <p className="rule-eyebrow text-[9px] text-muted-foreground">
                Last scan
              </p>
              <p className="mt-1 font-meta text-sm leading-tight">
                {lastScanned ? relativeTime(lastScanned) : "—"}
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Primary column — the change feed is the focus */}
        <section className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between border-b border-border pb-2">
            <h2 className="font-display text-2xl tracking-tight">
              Detected changes
            </h2>
            {feed.length > 0 && (
              <span className="font-meta text-xs tabular-nums text-muted-foreground">
                {feed.length} shown
              </span>
            )}
          </div>
          {feed.length === 0 ? (
            <EmptyState
              icon={Activity}
              title="No changes yet"
              description="Run a scan on a source to capture the baseline snapshot. Sightline detects and summarizes what changed on the next scan — with a redline of the exact diff."
              hint="No deltas yet"
            />
          ) : (
            <div className="flex flex-col gap-4">
              {feed.map((data, i) => (
                <ChangeCard key={changes[i]!.id} data={data} index={i} />
              ))}
            </div>
          )}
        </section>

        {/* Rail — evidence sources + scoped research */}
        <aside className="flex flex-col gap-6 lg:sticky lg:top-24 lg:self-start">
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="flex items-center gap-2 font-display text-lg">
                Evidence sources
              </h2>
              <span className="font-meta text-[11px] tabular-nums text-muted-foreground">
                {String(competitor.sources.length).padStart(2, "0")}
              </span>
            </div>
            <div className="flex flex-col gap-3 p-4">
              {competitor.sources.length === 0 ? (
                <p className="font-meta text-[11px] text-muted-foreground">
                  No sources yet — add a public page below, then scan.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {competitor.sources.map((s, i) => (
                    <li
                      key={s.id}
                      className="relative overflow-hidden rounded-lg border border-border bg-secondary/30 p-2.5 pl-3.5"
                    >
                      <span
                        aria-hidden
                        className="absolute inset-y-0 left-0 w-1"
                        style={{
                          backgroundColor: s.lastScannedAt
                            ? "var(--teal)"
                            : "color-mix(in srgb, var(--amber) 60%, transparent)",
                        }}
                      />
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="font-meta text-[10px] text-muted-foreground">
                            S{String(i + 1).padStart(2, "0")}
                          </span>
                          <Badge variant="secondary">{s.type}</Badge>
                          <a
                            href={s.url}
                            target="_blank"
                            rel="noreferrer"
                            title={s.url}
                            className="min-w-0 truncate font-meta text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                          >
                            {displayHost(s.url)}
                          </a>
                        </div>
                        <ScanButton sourceId={s.id} />
                      </div>
                      <p className="mt-1.5 font-meta text-[11px] tabular-nums text-muted-foreground">
                        {s._count.snapshots} snapshot
                        {s._count.snapshots === 1 ? "" : "s"} ·{" "}
                        {s.lastScannedAt
                          ? `scanned ${relativeTime(s.lastScannedAt)}`
                          : "never scanned"}
                      </p>
                    </li>
                  ))}
                </ul>
              )}

              <div className="border-t border-border pt-3">
                <AddSourceForm competitorId={competitor.id} />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <p className="rule-eyebrow text-[10px] text-muted-foreground">
              Research · scoped to {competitor.name}
            </p>
            <AskSightline competitorId={competitor.id} />
          </div>
        </aside>
      </div>
    </div>
  );
}
