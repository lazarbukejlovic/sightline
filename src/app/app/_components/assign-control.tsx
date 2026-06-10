"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { assignChange, type ActionState } from "@/app/app/actions";

export interface MemberOption {
  userId: string;
  name: string;
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="outline" disabled={pending}>
      {pending ? "…" : "Assign"}
    </Button>
  );
}

export function AssignControl({
  changeId,
  members,
  currentAssigneeId,
  currentAssigneeName,
}: {
  changeId: string;
  members: MemberOption[];
  currentAssigneeId: string | null;
  currentAssigneeName: string | null;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    assignChange,
    {},
  );

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="changeId" value={changeId} />
      <select
        name="assigneeId"
        defaultValue={currentAssigneeId ?? ""}
        className={cn(
          "h-9 rounded-md border border-input bg-card px-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
        aria-label="Assign to teammate"
      >
        <option value="" disabled>
          Assign to…
        </option>
        {members.map((m) => (
          <option key={m.userId} value={m.userId}>
            {m.name}
          </option>
        ))}
      </select>
      <Submit />
      {currentAssigneeName && !state.message && (
        <span className="font-meta text-[11px] text-muted-foreground">
          → {currentAssigneeName}
        </span>
      )}
      {state.message && (
        <span className="font-meta text-[11px] text-teal">{state.message}</span>
      )}
      {state.error && (
        <span className="font-meta text-[11px] text-signal">{state.error}</span>
      )}
    </form>
  );
}
