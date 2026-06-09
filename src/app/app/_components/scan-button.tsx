"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { scanSource, type ActionState } from "@/app/app/actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="signal" disabled={pending}>
      {pending ? "Scanning…" : "Scan now"}
    </Button>
  );
}

export function ScanButton({ sourceId }: { sourceId: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    scanSource,
    {},
  );

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="sourceId" value={sourceId} />
      <Submit />
      {(state.error || state.message) && (
        <span
          className={`font-meta text-xs ${
            state.error ? "text-signal" : "text-muted-foreground"
          }`}
        >
          {state.error ?? state.message}
        </span>
      )}
    </form>
  );
}
