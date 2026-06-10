"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { reviewChange, type ActionState } from "@/app/app/actions";

function SubmitButton({
  decision,
  label,
}: {
  decision: "reviewed" | "dismissed";
  label: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      name="decision"
      value={decision}
      size="sm"
      variant={decision === "reviewed" ? "default" : "outline"}
      disabled={pending}
    >
      {pending ? "…" : label}
    </Button>
  );
}

export function ReviewActions({ changeId }: { changeId: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    reviewChange,
    {},
  );

  if (state.message) {
    return (
      <p className="font-meta text-xs text-muted-foreground">{state.message}</p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="changeId" value={changeId} />
      <div className="flex items-center gap-2">
        {/* Both buttons submit the same form; `decision` is set by the
            clicked button's value (reviewed | dismissed). */}
        <SubmitButton decision="dismissed" label="Dismiss" />
        <SubmitButton decision="reviewed" label="Mark reviewed" />
      </div>
      {state.error && (
        <span className="font-meta text-xs text-signal">{state.error}</span>
      )}
    </form>
  );
}
