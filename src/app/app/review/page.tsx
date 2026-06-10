import type { Metadata } from "next";
import { prisma } from "@/lib/db/prisma";
import { requireOrgContext } from "@/lib/org/context";
import { REVIEW_CONFIDENCE_THRESHOLD } from "@/lib/constants";
import { ConfidenceMeter } from "@/components/confidence-meter";
import { initials, relativeTime, displayHost } from "@/lib/format";
import { ReviewActions } from "@/app/app/_components/review-actions";

export const metadata: Metadata = { title: "Review Queue · Sightline" };
export const dynamic = "force-dynamic";

export default async function ReviewQueuePage() {
  const { orgId } = await requireOrgContext();

  // Low-confidence, still-new changes await a human decision. AI is
  // decision-support, never the final authority.
  const items = await prisma.change.findMany({
    where: {
      orgId,
      status: "new",
      confidence: { lt: REVIEW_CONFIDENCE_THRESHOLD },
    },
    orderBy: { detectedAt: "desc" },
    include: {
      competitor: { select: { name: true } },
      source: { select: { url: true, type: true } },
    },
  });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header>
        <p className="font-meta text-xs uppercase tracking-wider text-signal">
          Review Queue
        </p>
        <h1 className="mt-1 font-display text-3xl tracking-tight">
          Low-confidence intel
        </h1>
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">
          Changes the analyst flagged with confidence below{" "}
          {Math.round(REVIEW_CONFIDENCE_THRESHOLD * 100)}%. Approve to move them
          into the Intel Feed, or dismiss them. Nothing is auto-published.
        </p>
      </header>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-secondary/30 p-8 text-center">
          <h2 className="font-display text-2xl">Queue clear</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            No low-confidence changes are waiting. New uncertain findings will
            land here for a human to verify.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {items.map((c) => (
            <li
              key={c.id}
              className="rounded-xl border border-border bg-card p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-md bg-secondary font-meta text-xs font-semibold">
                    {initials(c.competitor.name)}
                  </span>
                  <div>
                    <h3 className="font-display text-lg leading-tight">
                      {c.competitor.name}
                    </h3>
                    <p className="font-meta text-xs text-muted-foreground">
                      {relativeTime(c.detectedAt)} · {c.source.type} ·{" "}
                      {displayHost(c.source.url)}
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-secondary px-2.5 py-0.5 font-meta text-[11px] uppercase tracking-wide text-secondary-foreground">
                  {c.category}
                </span>
              </div>

              <p className="mt-4 text-[15px] leading-relaxed">{c.summary}</p>
              <p className="mt-2 border-l-2 border-signal/40 pl-3 text-sm italic text-muted-foreground">
                Why it matters: {c.whyItMatters}
              </p>

              <div className="mt-4 flex items-center justify-between gap-4">
                <ConfidenceMeter value={c.confidence} animate={false} />
                <ReviewActions changeId={c.id} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
