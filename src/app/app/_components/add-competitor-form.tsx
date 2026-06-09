"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCompetitor, type ActionState } from "@/app/app/actions";
import { FormFeedback } from "./form-feedback";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" className="w-full" disabled={pending}>
      {pending ? "Adding…" : "Add competitor"}
    </Button>
  );
}

export function AddCompetitorForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(
    createCompetitor,
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="competitor-name">Competitor name</Label>
        <Input
          id="competitor-name"
          name="name"
          required
          placeholder="Northwind"
          autoComplete="off"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="competitor-domain">Domain (optional)</Label>
        <Input
          id="competitor-domain"
          name="domain"
          placeholder="northwind.com"
          autoComplete="off"
        />
      </div>
      <FormFeedback state={state} />
      <Submit />
    </form>
  );
}
