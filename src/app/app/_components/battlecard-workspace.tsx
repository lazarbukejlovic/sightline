"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LiveblocksProvider,
  RoomProvider,
  useRoom,
  useOthers,
  useSelf,
} from "@liveblocks/react";
import { getYjsProviderForRoom } from "@liveblocks/yjs";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, placeholder } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { yCollab } from "y-codemirror.next";
import { FileText, Sparkles, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DURATION, EASE_OUT, staggerContainer, staggerItem } from "@/lib/motion";
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
    <div className="flex items-center">
      <div className="flex items-center -space-x-2">
        <AnimatePresence initial={false}>
          {people.map((p) => (
            <motion.span
              key={p.id}
              layout
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              whileHover={{ y: -2, scale: 1.08, zIndex: 10 }}
              transition={{ duration: DURATION.fast, ease: EASE_OUT }}
              title={p.you ? `${p.name} (you)` : p.name}
              className="flex size-8 items-center justify-center rounded-full border-2 border-background font-meta text-[11px] font-semibold text-white shadow-sm"
              style={{ backgroundColor: p.color }}
            >
              {initials(p.name)}
            </motion.span>
          ))}
        </AnimatePresence>
      </div>
      <span className="pl-3 font-meta text-xs tabular-nums text-muted-foreground">
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
  // Increments each time a suggestion is applied → triggers a one-shot sweep
  // across the document (purely presentational; the insert itself is unchanged).
  const [appliedFlash, setAppliedFlash] = useState(0);

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
          placeholder(
            "Start the battlecard… positioning, pricing counters, objection handling. Markdown supported.",
          ),
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
    setAppliedFlash((n) => n + 1); // fire the "applied" sweep
  }

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_340px]">
      {/* Editor column — a "document window" that lifts into place */}
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: DURATION.base, ease: EASE_OUT }}
        className="flex flex-col gap-2"
      >
        <motion.div
          initial={{ scale: 0.985 }}
          animate={{ scale: 1 }}
          transition={{ duration: DURATION.base, ease: EASE_OUT, delay: 0.04 }}
          className="overflow-hidden rounded-xl border border-border bg-card shadow-md ring-0 transition-shadow duration-300 focus-within:ring-1 focus-within:ring-inset focus-within:ring-signal/25"
        >
          {/* top signal line sweeps across once on mount */}
          <div className="relative h-0.5 w-full overflow-hidden bg-signal/15">
            <motion.div
              aria-hidden
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: DURATION.slow, ease: EASE_OUT, delay: 0.1 }}
              style={{ transformOrigin: "left" }}
              className="h-full w-full bg-signal"
            />
          </div>

          {/* window chrome */}
          <div className="flex items-center justify-between gap-3 border-b border-border bg-secondary/50 px-4 py-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <span aria-hidden className="hidden gap-1 sm:flex">
                <span className="size-2.5 rounded-full bg-signal/70" />
                <span className="size-2.5 rounded-full bg-amber/60" />
                <span className="size-2.5 rounded-full bg-teal/60" />
              </span>
              <FileText
                className="size-4 shrink-0 text-muted-foreground sm:hidden"
                strokeWidth={1.5}
              />
              <span className="truncate font-meta text-xs text-muted-foreground">
                <span className="text-foreground">{props.competitorName}</span>{" "}
                · battlecard.md
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-4">
              <AvatarStack userName={props.userName} />
              <span className="flex items-center gap-1.5 font-meta text-xs text-muted-foreground">
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    synced ? "animate-breathe bg-teal" : "animate-pulse bg-amber",
                  )}
                />
                {synced ? "Live" : "Connecting…"}
                {!props.canEdit && " · read-only"}
              </span>
            </div>
          </div>

          {/* editor body — paper texture + ledger margin + applied-flash */}
          <div className="relative">
            <div
              aria-hidden
              className="dossier-grid pointer-events-none absolute inset-0 opacity-[0.3]"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-[3.25rem] w-px bg-signal/10"
            />
            <AnimatePresence>
              {appliedFlash > 0 && (
                <motion.div
                  key={appliedFlash}
                  aria-hidden
                  initial={{ x: "-120%", opacity: 0.9 }}
                  animate={{ x: "360%", opacity: 0 }}
                  transition={{ duration: DURATION.slow, ease: EASE_OUT }}
                  className="pointer-events-none absolute inset-y-0 left-0 z-10 w-1/3"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent, color-mix(in srgb, var(--teal) 16%, transparent), transparent)",
                  }}
                />
              )}
            </AnimatePresence>
            <div ref={editorParent} className="relative min-h-[460px]" />
          </div>

          {/* document footer — template scaffolding + status strip */}
          <div className="flex flex-wrap items-center gap-1.5 border-t border-border bg-secondary/20 px-4 py-2.5">
            <span className="rule-eyebrow text-[10px] text-muted-foreground">
              Suggested sections
            </span>
            {["Positioning", "Pricing counters", "Objections", "Proof points"].map(
              (s) => (
                <span
                  key={s}
                  className="rounded-full border border-border bg-card px-2 py-0.5 font-meta text-[10px] text-muted-foreground"
                >
                  {s}
                </span>
              ),
            )}
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-border bg-card px-4 py-1.5">
            <span className="rule-eyebrow text-[9px] text-muted-foreground">
              Collaborative markdown · autosaved · human-approved intel
            </span>
            <span className="flex items-center gap-1.5 font-meta text-[10px] text-muted-foreground">
              <span
                className={cn(
                  "size-1 rounded-full",
                  synced ? "bg-teal" : "bg-amber",
                )}
              />
              {synced ? "synced" : "syncing"}
            </span>
          </div>
        </motion.div>
        <p className="px-1 font-meta text-xs text-muted-foreground">
          Markdown · edits sync live to everyone in this room.
        </p>
      </motion.section>

      {/* Side column: suggestions + comments stagger in after the editor */}
      <motion.aside
        variants={staggerContainer(0.1, 0.18)}
        initial="hidden"
        animate="show"
        className="flex flex-col gap-6"
      >
        <motion.div
          variants={staggerItem}
          className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border bg-secondary/40 px-4 py-2.5">
            <span className="flex items-center gap-2">
              <Sparkles className="size-3.5 text-signal" strokeWidth={1.75} />
              <span className="rule-eyebrow text-[10px] text-muted-foreground">
                Suggested edits
              </span>
            </span>
            <span className="font-meta text-[10px] tabular-nums text-muted-foreground">
              {props.suggestions.length} pending
            </span>
          </div>
          <div className="p-4">
            <SuggestionsPanel
              battlecardId={props.battlecardId}
              suggestions={props.suggestions}
              canEdit={props.canEdit}
              onApprove={insertAtEnd}
            />
          </div>
        </motion.div>
        <motion.div
          variants={staggerItem}
          className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
        >
          <div className="flex items-center gap-2 border-b border-border bg-secondary/40 px-4 py-2.5">
            <MessageSquare className="size-3.5 text-teal" strokeWidth={1.75} />
            <span className="rule-eyebrow text-[10px] text-muted-foreground">
              Discussion
            </span>
          </div>
          <div className="p-4">
            <CommentsPanel
              targetType="battlecard"
              targetId={props.battlecardId}
              comments={props.comments}
              canComment={props.canEdit}
              hideHeader
            />
          </div>
        </motion.div>
      </motion.aside>
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
      {pending.length === 0 ? (
        <p className="font-meta text-xs leading-relaxed text-muted-foreground">
          High-impact changes draft suggested battlecard edits here for a human
          to approve — never auto-applied.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          <AnimatePresence initial={false} mode="popLayout">
            {pending.map((s) => (
              <motion.li
                key={s.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 16, scale: 0.97 }}
                transition={{ duration: DURATION.base, ease: EASE_OUT }}
                className="relative overflow-hidden rounded-lg border border-signal/30 bg-signal/5 p-3 pl-4"
              >
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 w-1 bg-signal/60"
                />
                <p className="whitespace-pre-wrap text-sm text-foreground [overflow-wrap:anywhere]">
                  {s.content}
                </p>
                <p className="mt-1.5 flex items-center gap-1.5 font-meta text-[11px] text-muted-foreground">
                  <Sparkles className="size-3 text-signal/70" strokeWidth={1.75} />
                  Drafted {relativeTime(new Date(s.createdAt))} · never
                  auto-applied
                </p>
                {canEdit && (
                  <div className="mt-2.5 flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="signal"
                      disabled={isPending}
                      onClick={() => resolve(s, "approved")}
                      className="transition-transform active:scale-[0.97]"
                    >
                      Approve &amp; insert
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isPending}
                      onClick={() => resolve(s, "rejected")}
                      className="transition-transform active:scale-[0.97]"
                    >
                      Reject
                    </Button>
                  </div>
                )}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
      {error && <p className="font-meta text-xs text-signal">{error}</p>}
    </div>
  );
}

const editorTheme = EditorView.theme({
  "&": {
    fontSize: "14.5px",
    backgroundColor: "transparent",
    color: "var(--foreground)",
  },
  ".cm-scroller": {
    fontFamily: "var(--font-sans)",
    lineHeight: "1.75",
  },
  ".cm-content": {
    padding: "20px 20px 28px",
    caretColor: "var(--ink)",
  },
  ".cm-line": { padding: "0 4px" },
  ".cm-gutters": {
    backgroundColor: "transparent",
    // Faint "ledger margin" rule after the line numbers — document texture.
    borderRight: "1px dashed color-mix(in srgb, var(--ink) 10%, transparent)",
    color: "color-mix(in srgb, var(--ink) 28%, transparent)",
    paddingRight: "8px",
    marginRight: "8px",
  },
  ".cm-lineNumbers .cm-gutterElement": { fontFamily: "var(--font-mono)", fontSize: "11px" },
  "&.cm-focused": { outline: "none" },
  ".cm-cursor": { borderLeftColor: "var(--ink)", borderLeftWidth: "2px" },
  ".cm-activeLine": {
    backgroundColor: "color-mix(in srgb, var(--ink) 3%, transparent)",
    boxShadow: "inset 2px 0 0 color-mix(in srgb, var(--signal) 22%, transparent)",
  },
  ".cm-activeLineGutter": { backgroundColor: "transparent" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
    backgroundColor: "color-mix(in srgb, var(--signal) 16%, transparent)",
  },
  ".cm-placeholder": {
    color: "var(--muted-foreground)",
    fontStyle: "italic",
  },
  // Smooth remote presence cursors/selections (no jitter as peers move).
  ".cm-ySelectionCaret": {
    transition: "all 90ms cubic-bezier(0.22, 1, 0.36, 1)",
  },
  ".cm-ySelectionInfo": {
    transition: "opacity 140ms ease, transform 140ms ease",
    borderRadius: "0 4px 4px 0",
    padding: "2px 5px",
    fontFamily: "var(--font-mono)",
    fontSize: "10px",
    letterSpacing: "0.02em",
  },
});
