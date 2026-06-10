"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  LiveblocksProvider,
  RoomProvider,
  useRoom,
  useOthers,
  useSelf,
} from "@liveblocks/react";
import { getYjsProviderForRoom } from "@liveblocks/yjs";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { yCollab } from "y-codemirror.next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { initials, relativeTime } from "@/lib/format";
import { resolveSuggestion } from "@/app/app/actions";
import {
  CommentsPanel,
  type CommentView,
} from "@/app/app/_components/comments-panel";

export interface SuggestionView {
  id: string;
  content: string;
  createdAt: string;
}

export interface BattlecardWorkspaceProps {
  roomId: string;
  battlecardId: string;
  title: string;
  competitorName: string;
  canEdit: boolean;
  userName: string;
  userColor: string;
  suggestions: SuggestionView[];
  comments: CommentView[];
}

export function BattlecardWorkspace(props: BattlecardWorkspaceProps) {
  return (
    <LiveblocksProvider authEndpoint="/api/liveblocks-auth">
      <RoomProvider id={props.roomId} initialPresence={{}}>
        <BattlecardRoom {...props} />
      </RoomProvider>
    </LiveblocksProvider>
  );
}

function AvatarStack({ userName }: { userName: string }) {
  const others = useOthers();
  const self = useSelf();

  const people = [
    self ? { id: "self", name: self.info?.name ?? userName, color: self.info?.color ?? "#888", you: true } : null,
    ...others.map((o) => ({
      id: String(o.connectionId),
      name: o.info?.name ?? "Teammate",
      color: o.info?.color ?? "#888",
      you: false,
    })),
  ].filter(Boolean) as { id: string; name: string; color: string; you: boolean }[];

  return (
    <div className="flex items-center -space-x-2">
      {people.map((p) => (
        <span
          key={p.id}
          title={p.you ? `${p.name} (you)` : p.name}
          className="flex size-8 items-center justify-center rounded-full border-2 border-background font-meta text-[11px] font-semibold text-white"
          style={{ backgroundColor: p.color }}
        >
          {initials(p.name)}
        </span>
      ))}
      <span className="pl-4 font-meta text-xs text-muted-foreground">
        {people.length} here
      </span>
    </div>
  );
}

function BattlecardRoom(props: BattlecardWorkspaceProps) {
  const room = useRoom();
  const editorParent = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    const parent = editorParent.current;
    if (!parent) return;

    const yProvider = getYjsProviderForRoom(room);
    const yDoc = yProvider.getYDoc();
    const yText = yDoc.getText("content");
    const awareness = yProvider.awareness;
    awareness.setLocalStateField("user", {
      name: props.userName,
      color: props.userColor,
      colorLight: props.userColor,
    });

    const onSync = (isSynced: boolean) => setSynced(isSynced);
    yProvider.on("sync", onSync);

    const view = new EditorView({
      parent,
      state: EditorState.create({
        doc: yText.toString(),
        extensions: [
          lineNumbers(),
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          markdown(),
          EditorView.lineWrapping,
          EditorView.editable.of(props.canEdit),
          EditorState.readOnly.of(!props.canEdit),
          yCollab(yText, awareness),
          editorTheme,
        ],
      }),
    });
    viewRef.current = view;

    return () => {
      yProvider.off("sync", onSync);
      view.destroy();
      viewRef.current = null;
    };
    // Re-create the editor only if identity-affecting props change.
  }, [room, props.canEdit, props.userName, props.userColor]);

  function insertAtEnd(text: string) {
    const view = viewRef.current;
    if (!view) return;
    const at = view.state.doc.length;
    view.dispatch({
      changes: { from: at, insert: `${at > 0 ? "\n\n" : ""}${text}` },
    });
    view.focus();
  }

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_340px]">
      {/* Editor column */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <AvatarStack userName={props.userName} />
          <span className="flex items-center gap-1.5 font-meta text-xs text-muted-foreground">
            <span
              className={cn(
                "size-1.5 rounded-full",
                synced ? "bg-teal" : "animate-pulse bg-amber-500",
              )}
            />
            {synced ? "Live" : "Connecting…"}
            {!props.canEdit && " · read-only"}
          </span>
        </div>

        <div
          ref={editorParent}
          className="min-h-[420px] overflow-hidden rounded-xl border border-border bg-card shadow-sm"
        />
        <p className="font-meta text-xs text-muted-foreground">
          Markdown · changes sync live to everyone in this room.
        </p>
      </section>

      {/* Side column: suggestions + comments */}
      <aside className="flex flex-col gap-6">
        <SuggestionsPanel
          battlecardId={props.battlecardId}
          suggestions={props.suggestions}
          canEdit={props.canEdit}
          onApprove={insertAtEnd}
        />
        <CommentsPanel
          targetType="battlecard"
          targetId={props.battlecardId}
          comments={props.comments}
          canComment={props.canEdit}
        />
      </aside>
    </div>
  );
}

function SuggestionsPanel({
  battlecardId,
  suggestions,
  canEdit,
  onApprove,
}: {
  battlecardId: string;
  suggestions: SuggestionView[];
  canEdit: boolean;
  onApprove: (text: string) => void;
}) {
  const [pending, setPending] = useState(suggestions);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function resolve(s: SuggestionView, decision: "approved" | "rejected") {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("suggestionId", s.id);
      fd.set("decision", decision);
      fd.set("battlecardId", battlecardId);
      const res = await resolveSuggestion({}, fd);
      if (res.error) {
        setError(res.error);
        return;
      }
      if (decision === "approved") onApprove(s.content);
      setPending((prev) => prev.filter((x) => x.id !== s.id));
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-display text-base">
        Suggested edits{" "}
        <span className="font-meta text-xs text-muted-foreground">
          ({pending.length} pending)
        </span>
      </h3>

      {pending.length === 0 ? (
        <p className="font-meta text-xs text-muted-foreground">
          High-impact changes will draft suggested battlecard edits here for a
          human to approve.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {pending.map((s) => (
            <li
              key={s.id}
              className="rounded-lg border border-signal/30 bg-signal/5 p-3"
            >
              <p className="whitespace-pre-wrap text-sm text-foreground">
                {s.content}
              </p>
              <p className="mt-1 font-meta text-[11px] text-muted-foreground">
                Drafted {relativeTime(new Date(s.createdAt))} · never
                auto-applied
              </p>
              {canEdit && (
                <div className="mt-2 flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="signal"
                    disabled={isPending}
                    onClick={() => resolve(s, "approved")}
                  >
                    Approve &amp; insert
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => resolve(s, "rejected")}
                  >
                    Reject
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && <p className="font-meta text-xs text-signal">{error}</p>}
    </div>
  );
}

const editorTheme = EditorView.theme({
  "&": {
    fontSize: "14px",
    backgroundColor: "var(--card)",
    color: "var(--foreground)",
  },
  ".cm-content": {
    padding: "16px 12px",
    fontFamily: "var(--font-sans)",
    lineHeight: "1.6",
    caretColor: "var(--foreground)",
  },
  ".cm-gutters": {
    backgroundColor: "transparent",
    border: "none",
    color: "var(--muted-foreground)",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-line": { padding: "0 4px" },
});
