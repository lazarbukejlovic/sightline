import type { Metadata } from "next";
import { prisma } from "@/lib/db/prisma";
import { requireOrgContext } from "@/lib/org/context";
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
        <p className="font-meta text-xs uppercase tracking-wider text-signal">
          Weekly digest
        </p>
        <h1 className="mt-1 font-display text-3xl tracking-tight">
          Your briefings
        </h1>
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">
          A summary of each week&apos;s competitor changes, generated every
          Monday. Stays grounded in detected changes — no invented intel.
        </p>
      </header>

      {digests.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-secondary/30 p-8 text-center">
          <h2 className="font-display text-2xl">No digests yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            The first weekly digest is generated on the next Monday run. You can
            also trigger <span className="font-meta">weekly-digest</span> from
            the Inngest dev dashboard to preview one now.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {digests.map((d) => (
            <li
              key={d.id}
              className="rounded-xl border border-border bg-card p-5 shadow-sm"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-display text-xl">
                  {formatRange({
                    periodStart: d.periodStart,
                    periodEnd: d.periodEnd,
                  })}
                </h2>
                <span className="font-meta text-xs text-muted-foreground">
                  {d.changeCount} change{d.changeCount === 1 ? "" : "s"}
                </span>
              </div>
              <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {d.summary}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
