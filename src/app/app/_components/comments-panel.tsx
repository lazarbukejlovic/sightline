"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addComment, type ActionState } from "@/app/app/actions";
import { relativeTime, userColor, initials } from "@/lib/format";
import { DURATION, EASE_OUT, staggerContainer, staggerItem } from "@/lib/motion";

export interface CommentView {
  id: string;
  authorName: string;
  body: string;
  createdAt: string; // ISO
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="sm"
      disabled={pending}
      className="transition-transform active:scale-[0.97]"
    >
      {pending ? "Posting…" : "Comment"}
    </Button>
  );
}

export function CommentsPanel({
  targetType,
  targetId,
  comments,
  canComment,
  hideHeader = false,
}: {
  targetType: "change" | "battlecard";
  targetId: string;
  comments: CommentView[];
  canComment: boolean;
  /** Hide the internal title when the surrounding card already provides one. */
  hideHeader?: boolean;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    addComment,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the box after a successful post (the list refreshes via revalidation).
  useEffect(() => {
    if (state.message) formRef.current?.reset();
  }, [state.message]);

  return (
    <div className="flex flex-col gap-3">
      {!hideHeader && (
        <h3 className="font-display text-base">
          Comments{" "}
          <span className="font-meta text-xs text-muted-foreground">
            ({comments.length})
          </span>
        </h3>
      )}

      {comments.length === 0 && (
        <p className="font-meta text-xs text-muted-foreground">
          No comments yet.
        </p>
      )}

      {comments.length > 0 && (
        <motion.ul
          className="flex flex-col gap-3"
          variants={staggerContainer(0.05)}
          initial="hidden"
          animate="show"
        >
          {comments.map((c) => (
            <motion.li
              key={c.id}
              variants={staggerItem}
              className="rounded-lg border border-border bg-card p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="flex size-5 shrink-0 items-center justify-center rounded-full font-meta text-[9px] font-semibold text-white"
                    style={{ backgroundColor: userColor(c.authorName) }}
                    aria-hidden
                  >
                    {initials(c.authorName)}
                  </span>
                  <span className="min-w-0 truncate text-sm font-medium">
                    {c.authorName}
                  </span>
                </span>
                <span className="shrink-0 font-meta text-[11px] tabular-nums text-muted-foreground">
                  {relativeTime(new Date(c.createdAt))}
                </span>
              </div>
              <p className="mt-1.5 whitespace-pre-wrap text-sm text-foreground [overflow-wrap:anywhere]">
                {c.body}
              </p>
            </motion.li>
          ))}
        </motion.ul>
      )}

      {canComment ? (
        <form
          ref={formRef}
          action={formAction}
          className="flex flex-col gap-2 rounded-lg border border-transparent transition-colors focus-within:border-border focus-within:bg-secondary/30 focus-within:p-2"
        >
          <input type="hidden" name="targetType" value={targetType} />
          <input type="hidden" name="targetId" value={targetId} />
          <Textarea
            name="body"
            rows={2}
            placeholder="Add a comment…"
            required
          />
          <div className="flex items-center justify-between">
            {state.error ? (
              <motion.span
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: DURATION.fast, ease: EASE_OUT }}
                className="font-meta text-xs text-signal"
              >
                {state.error}
              </motion.span>
            ) : (
              <span />
            )}
            <Submit />
          </div>
        </form>
      ) : (
        <p className="font-meta text-xs text-muted-foreground">
          You have read-only access — commenting is disabled.
        </p>
      )}
    </div>
  );
}
