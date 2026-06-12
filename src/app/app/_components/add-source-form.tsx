"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { createSource, type ActionState } from "@/app/app/actions";
import { FormFeedback } from "./form-feedback";

const SOURCE_TYPES = [
  { value: "pricing", label: "Pricing" },
  { value: "changelog", label: "Changelog" },
  { value: "blog", label: "Blog" },
  { value: "news", label: "News" },
  { value: "careers", label: "Careers" },
  { value: "custom", label: "Custom" },
] as const;

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" className="w-full" disabled={pending}>
      {pending ? "Adding…" : "Add source"}
    </Button>
  );
}

export function AddSourceForm({ competitorId }: { competitorId: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    createSource,
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="competitorId" value={competitorId} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="source-type">Type</Label>
        <select
          id="source-type"
          name="type"
          defaultValue="pricing"
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
          )}
        >
          {SOURCE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-1 flex-col gap-1.5">
        <Label htmlFor="source-url">Public URL</Label>
        <Input
          id="source-url"
          name="url"
          type="url"
          required
          placeholder="https://northwind.com/pricing"
          autoComplete="off"
        />
      </div>
      <Submit />
      <FormFeedback state={state} />
    </form>
  );
}
