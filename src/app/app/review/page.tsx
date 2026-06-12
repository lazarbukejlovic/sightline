import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { requireOrgContext } from "@/lib/org/context";
import { listOrgMembers } from "@/lib/org/members";
import { REVIEW_CONFIDENCE_THRESHOLD } from "@/lib/constants";
import { canEdit as roleCanEdit } from "@/lib/liveblocks/rooms";
import { ConfidenceMeter } from "@/components/confidence-meter";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { initials, relativeTime, displayHost } from "@/lib/format";
import { ReviewActions } from "@/app/app/_components/review-actions";
import { AssignControl } from "@/app/app/_components/assign-control";
import {
  CommentsPanel,
  type CommentView,
} from "@/app/app/_components/comments-panel";

export const metadata: Metadata = { title: "Review Queue · Sightline" };
export const dynamic = "force-dynamic";

export default async function ReviewQueuePage() {
  const { orgId, role } = await requireOrgContext();
  const canEdit = roleCanEdit(role);

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

  const changeIds = items.map((c) => c.id);
  const [members, assignments, commentRows] = await Promise.all([
    listOrgMembers(orgId),
    changeIds.length
      ? prisma.assignment.findMany({
          where: { orgId, changeId: { in: changeIds } },
        })
      : Promise.resolve([]),
    changeIds.length
      ? prisma.comment.findMany({
          where: { orgId, targetType: "change", targetId: { in: changeIds } },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const nameById = new Map(members.map((m) => [m.userId, m.name]));
  const assignmentByChange = new Map(assignments.map((a) => [a.changeId, a]));
  const commentsByChange = new Map<string, CommentView[]>();
  for (const c of commentRows) {
    const list = commentsByChange.get(c.targetId) ?? [];
    list.push({
      id: c.id,
      authorName: nameById.get(c.authorId) ?? "Teammate",
      body: c.body,
      createdAt: c.createdAt.toISOString(),
    });
    commentsByChange.set(c.targetId, list);
  }
  const memberOptions = members.map((m) => ({ userId: m.userId, name: m.name }));

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
        <EmptyState
          icon={CheckCircle2}
          title="No uncertain intel waiting"
          description="Low-confidence findings stop here before reaching the feed — a human verifies them first. Nothing is ever auto-published."
          hint="0 awaiting review"
        />
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
                <Badge variant="secondary">{c.category}</Badge>
              </div>

              <p className="mt-4 text-[15px] leading-relaxed">{c.summary}</p>
              <p className="mt-2 border-l-2 border-signal/40 pl-3 text-sm italic text-muted-foreground">
                Why it matters: {c.whyItMatters}
              </p>

              <div className="mt-4 flex items-center justify-between gap-4">
                <ConfidenceMeter value={c.confidence} animate={false} />
                <ReviewActions changeId={c.id} />
              </div>

              {canEdit && (
                <div className="mt-4 border-t border-border pt-4">
                  <AssignControl
                    changeId={c.id}
                    members={memberOptions}
                    currentAssigneeId={
                      assignmentByChange.get(c.id)?.assigneeId ?? null
                    }
                    currentAssigneeName={
                      assignmentByChange.get(c.id)
                        ? (nameById.get(
                            assignmentByChange.get(c.id)!.assigneeId,
                          ) ?? null)
                        : null
                    }
                  />
                </div>
              )}

              <div className="mt-4 border-t border-border pt-4">
                <CommentsPanel
                  targetType="change"
                  targetId={c.id}
                  comments={commentsByChange.get(c.id) ?? []}
                  canComment={canEdit}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
