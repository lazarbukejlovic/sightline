import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireOrgContext } from "@/lib/org/context";
import { listOrgMembers } from "@/lib/org/members";
import { liveblocksConfigured } from "@/lib/liveblocks/server";
import { canEdit as roleCanEdit } from "@/lib/liveblocks/rooms";
import { userColor } from "@/lib/format";
import {
  BattlecardWorkspace,
  type SuggestionView,
} from "@/app/app/_components/battlecard-workspace";
import {
  CommentsPanel,
  type CommentView,
} from "@/app/app/_components/comments-panel";

export const metadata: Metadata = { title: "Battlecard · Sightline" };
export const dynamic = "force-dynamic";

export default async function BattlecardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user, orgId, role } = await requireOrgContext();

  const battlecard = await prisma.battlecard.findFirst({
    where: { id, orgId },
  });
  if (!battlecard) notFound();

  const competitor = await prisma.competitor.findFirst({
    where: { id: battlecard.competitorId, orgId },
    select: { id: true, name: true },
  });
  if (!competitor) notFound();

  const [suggestionRows, commentRows, members] = await Promise.all([
    prisma.battlecardSuggestion.findMany({
      where: { orgId, battlecardId: battlecard.id, status: "pending" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.comment.findMany({
      where: { orgId, targetType: "battlecard", targetId: battlecard.id },
      orderBy: { createdAt: "asc" },
    }),
    listOrgMembers(orgId),
  ]);

  const nameById = new Map(members.map((m) => [m.userId, m.name]));
  const canEdit = roleCanEdit(role);

  const suggestions: SuggestionView[] = suggestionRows.map((s) => ({
    id: s.id,
    content: s.content,
    createdAt: s.createdAt.toISOString(),
  }));
  const comments: CommentView[] = commentRows.map((c) => ({
    id: c.id,
    authorName: nameById.get(c.authorId) ?? "Teammate",
    body: c.body,
    createdAt: c.createdAt.toISOString(),
  }));

  const userName =
    (user.user_metadata?.full_name as string | undefined)?.trim() ||
    user.email?.split("@")[0] ||
    "Teammate";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/app/competitors/${competitor.id}` as Route}
          className="font-meta text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          ← {competitor.name}
        </Link>
        <div className="mt-2 flex items-center justify-between gap-3">
          <h1 className="font-display text-3xl tracking-tight">
            {battlecard.title}
          </h1>
          <span className="rounded-full bg-secondary px-2.5 py-0.5 font-meta text-[11px] uppercase tracking-wide text-secondary-foreground">
            {battlecard.status}
          </span>
        </div>
        <p className="mt-1 font-meta text-xs text-muted-foreground">
          Collaborative battlecard · {canEdit ? "you can edit" : "read-only"}
        </p>
      </div>

      {liveblocksConfigured() ? (
        <BattlecardWorkspace
          roomId={battlecard.roomId}
          battlecardId={battlecard.id}
          title={battlecard.title}
          competitorName={competitor.name}
          canEdit={canEdit}
          userName={userName}
          userColor={userColor(user.id)}
          suggestions={suggestions}
          comments={comments}
        />
      ) : (
        <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="rounded-xl border border-dashed border-border bg-secondary/30 p-8 text-center">
            <h2 className="font-display text-2xl">Real-time editing is off</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Set <span className="font-meta">LIVEBLOCKS_SECRET_KEY</span> to
              enable the collaborative editor (presence, live cursors, Yjs).
              Comments and suggestions below still work.
            </p>
          </div>
          <aside className="flex flex-col gap-6">
            {suggestions.length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="font-display text-base">Suggested edits</h3>
                {suggestions.map((s) => (
                  <p
                    key={s.id}
                    className="whitespace-pre-wrap rounded-lg border border-signal/30 bg-signal/5 p-3 text-sm"
                  >
                    {s.content}
                  </p>
                ))}
              </div>
            )}
            <CommentsPanel
              targetType="battlecard"
              targetId={battlecard.id}
              comments={comments}
              canComment={canEdit}
            />
          </aside>
        </div>
      )}
    </div>
  );
}
