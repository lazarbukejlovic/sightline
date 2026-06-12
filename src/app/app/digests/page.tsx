import type { Metadata } from "next";
import { Newspaper } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { requireOrgContext } from "@/lib/org/context";
import { EmptyState } from "@/components/ui/empty-state";
import { Markdown } from "@/components/markdown";
import { formatRange } from "@/lib/digest-range";

export const metadata: Metadata = { title: "Digests · Sightline" };
export const dynamic = "force-dynamic";

export default async function DigestsPage() {
  const { orgId } = await requireOrgContext();

  const digests = await prisma.digest.findMany({
    where: { orgId },
    orderBy: { periodEnd: "desc" },
    take: 26,
  });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header>
        <p className="rule-eyebrow text-[10px] text-signal">Executive briefing</p>
        <h1 className="mt-1 font-display text-3xl tracking-tight">
          Your briefings
        </h1>
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">
          A summary of each week&apos;s competitor changes, generated every
          Monday. Stays grounded in detected changes — no invented intel.
        </p>
      </header>

      {digests.length === 0 ? (
        <EmptyState
          icon={Newspaper}
          title="No briefings filed yet"
          description={
            <>
              Each Monday, Sightline files a one-page briefing of the week&apos;s
              competitor moves — grounded strictly in detected changes. Trigger{" "}
              <span className="font-meta">weekly-digest</span> from the Inngest
              dashboard to preview one now.
            </>
          }
          hint="Next briefing · Mon 09:00 UTC"
        />
      ) : (
        <ul className="flex flex-col gap-5">
          {digests.map((d) => (
            <li
              key={d.id}
              className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
            >
              <div aria-hidden className="h-0.5 w-full bg-signal/70" />
              <div className="flex items-center justify-between gap-3 border-b border-border bg-secondary/30 px-5 py-3">
                <div className="min-w-0">
                  <p className="rule-eyebrow text-[9px] text-muted-foreground">
                    Weekly briefing
                  </p>
                  <h2 className="font-display text-xl tracking-tight">
                    {formatRange({
                      periodStart: d.periodStart,
                      periodEnd: d.periodEnd,
                    })}
                  </h2>
                </div>
                <span className="shrink-0 rounded-full border border-border bg-card px-2.5 py-0.5 font-meta text-[11px] tabular-nums text-muted-foreground">
                  {d.changeCount} change{d.changeCount === 1 ? "" : "s"}
                </span>
              </div>
              <Markdown content={d.summary} className="p-5" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
