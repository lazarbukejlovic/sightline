import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireOrgContext } from "@/lib/org/context";
import { ChangeCard, type ChangeCardData } from "@/components/change-card";
import { initials, relativeTime, displayHost } from "@/lib/format";
import { AddSourceForm } from "@/app/app/_components/add-source-form";
import { ScanButton } from "@/app/app/_components/scan-button";
import { AskSightline } from "@/app/app/_components/ask-sightline";

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

  const changes = await prisma.change.findMany({
    where: { orgId, competitorId: competitor.id },
    orderBy: { detectedAt: "desc" },
    take: 25,
    include: { source: { select: { url: true } } },
  });

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
  }));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href="/app"
          className="font-meta text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          ← Intel Feed
        </Link>
        <div className="mt-3 flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-lg bg-secondary font-display text-lg">
            {initials(competitor.name)}
          </span>
          <div>
            <h1 className="font-display text-4xl tracking-tight">
              {competitor.name}
            </h1>
            {competitor.domain && (
              <p className="font-meta text-xs text-muted-foreground">
                {competitor.domain}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-8">
          {/* Sources */}
          <section className="flex flex-col gap-4">
            <h2 className="font-display text-2xl">Sources</h2>

            {competitor.sources.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No sources yet. Add a public page below, then run a scan.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {competitor.sources.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 shadow-sm"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-secondary px-2 py-0.5 font-meta text-[11px] uppercase tracking-wide text-secondary-foreground">
                          {s.type}
                        </span>
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noreferrer"
                          className="truncate font-meta text-xs text-muted-foreground underline-offset-2 hover:underline"
                        >
                          {s.url}
                        </a>
                      </div>
                      <p className="mt-1 font-meta text-[11px] text-muted-foreground">
                        {s._count.snapshots} snapshot
                        {s._count.snapshots === 1 ? "" : "s"} ·{" "}
                        {s.lastScannedAt
                          ? `scanned ${relativeTime(s.lastScannedAt)}`
                          : "never scanned"}
                      </p>
                    </div>
                    <ScanButton sourceId={s.id} />
                  </li>
                ))}
              </ul>
            )}

            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <h3 className="mb-3 font-display text-base">Add a source</h3>
              <AddSourceForm competitorId={competitor.id} />
            </div>
          </section>

          {/* Changes */}
          <section className="flex flex-col gap-4">
            <h2 className="font-display text-2xl">Detected changes</h2>
            {feed.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-secondary/30 p-6 text-center text-sm text-muted-foreground">
                No changes yet. Run a scan on a source to capture the first
                snapshot and detect changes on the next scan.
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {feed.map((data, i) => (
                  <ChangeCard key={changes[i]!.id} data={data} index={i} />
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <AskSightline competitorId={competitor.id} />
        </aside>
      </div>
    </div>
  );
}
