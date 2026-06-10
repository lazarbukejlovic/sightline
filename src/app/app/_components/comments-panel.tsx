"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addComment, type ActionState } from "@/app/app/actions";
import { relativeTime } from "@/lib/format";

export interface CommentView {
  id: string;
  authorName: string;
  body: string;
  createdAt: string; // ISO
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Posting…" : "Comment"}
    </Button>
  );
}

export function CommentsPanel({
  targetType,
  targetId,
  comments,
  canComment,
}: {
  targetType: "change" | "battlecard";
  targetId: string;
  comments: CommentView[];
  canComment: boolean;
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
      <h3 className="font-display text-base">
        Comments{" "}
        <span className="font-meta text-xs text-muted-foreground">
          ({comments.length})
        </span>
      </h3>

      {comments.length > 0 && (
        <ul className="flex flex-col gap-3">
          {comments.map((c) => (
            <li key={c.id} className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium">{c.authorName}</span>
                <span className="font-meta text-[11px] text-muted-foreground">
                  {relativeTime(new Date(c.createdAt))}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                {c.body}
              </p>
            </li>
          ))}
        </ul>
      )}

      {canComment ? (
        <form ref={formRef} action={formAction} className="flex flex-col gap-2">
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
              <span className="font-meta text-xs text-signal">{state.error}</span>
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
