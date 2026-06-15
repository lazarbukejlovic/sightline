import type { Metadata } from "next";
import { prisma } from "@/lib/db/prisma";
import { requireOrgContext } from "@/lib/org/context";
import { listOrgMembers } from "@/lib/org/members";
import { relativeTime } from "@/lib/format";
import { EmptyState } from "@/components/ui/empty-state";
import { Callout } from "@/components/ui/callout";
import { ScrollText } from "lucide-react";

export const metadata: Metadata = { title: "Audit log · Sightline" };
export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const { orgId, role } = await requireOrgContext();
  const isAdmin = role === "owner" || role === "admin";

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-3xl">
        <Callout tone="info">
          The audit log is visible to owners and admins only.
        </Callout>
      </div>
    );
  }

  const [entries, members] = await Promise.all([
    prisma.auditLog.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    listOrgMembers(orgId),
  ]);
  const nameById = new Map(members.map((m) => [m.userId, m.name]));

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header>
        <p className="rule-eyebrow text-[10px] text-signal">Security</p>
        <h1 className="mt-1 font-display text-3xl tracking-tight">Audit log</h1>
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">
          An append-only record of significant actions in this workspace — who
          did what, to what, and when. Owner/admin only.
        </p>
      </header>

      {entries.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No activity recorded yet"
          description="Actions like adding a competitor, running a scan, reviewing a change, or changing the plan will appear here with the actor and timestamp."
          hint="Append-only"
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border shadow-sm">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b-2 border-ink/15 bg-secondary/60">
                {["Actor", "Action", "Target", "When"].map((h) => (
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
              {entries.map((e) => (
                <tr
                  key={e.id}
                  className="border-b border-border/60 last:border-0 odd:bg-secondary/20"
                >
                  <td className="px-3.5 py-2">
                    {e.actorId ? (nameById.get(e.actorId) ?? "Teammate") : "System"}
                  </td>
                  <td className="px-3.5 py-2 font-meta text-xs">{e.action}</td>
                  <td className="max-w-[24ch] truncate px-3.5 py-2 font-meta text-xs text-muted-foreground">
                    {e.target ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-3.5 py-2 font-meta text-xs tabular-nums text-muted-foreground">
                    {relativeTime(e.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
