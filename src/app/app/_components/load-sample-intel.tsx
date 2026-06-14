"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { loadSampleIntel, type ActionState } from "@/app/app/actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="signal" disabled={pending}>
      {pending ? "Loading…" : "Load sample intel"}
    </Button>
  );
}

/** First-run shortcut: fill an empty workspace with the demo dataset. */
export function LoadSampleIntel() {
  const [state, formAction] = useActionState<ActionState, FormData>(
    loadSampleIntel,
    {},
  );

  return (
    <form action={formAction} className="flex flex-col items-center gap-2">
      <Submit />
      {state.error && (
        <span className="font-meta text-[11px] text-signal">{state.error}</span>
      )}
      <span className="font-meta text-[10px] text-muted-foreground">
        Vercel · Linear · Notion · Stripe — with sample changes
      </span>
    </form>
  );
}
