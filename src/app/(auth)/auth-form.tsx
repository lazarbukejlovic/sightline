"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AuthState } from "@/app/(auth)/actions";

type AuthAction = (state: AuthState, formData: FormData) => Promise<AuthState>;

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Working…" : label}
    </Button>
  );
}

export function AuthForm({
  mode,
  action,
}: {
  mode: "sign-in" | "sign-up";
  action: AuthAction;
}) {
  const [state, formAction] = useActionState<AuthState, FormData>(action, {});
  const isSignUp = mode === "sign-up";

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {isSignUp && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fullName">Full name</Label>
          <Input
            id="fullName"
            name="fullName"
            type="text"
            autoComplete="name"
            placeholder="Ada Lovelace"
          />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Work email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@company.com"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete={isSignUp ? "new-password" : "current-password"}
          placeholder="At least 8 characters"
        />
      </div>

      {state.error && (
        <p
          role="alert"
          className="rounded-md border border-signal/30 bg-signal/5 px-3 py-2 text-sm text-signal"
        >
          {state.error}
        </p>
      )}
      {state.message && (
        <p
          role="status"
          className="rounded-md border border-teal/30 bg-teal/5 px-3 py-2 text-sm text-teal"
        >
          {state.message}
        </p>
      )}

      <SubmitButton label={isSignUp ? "Create account" : "Sign in"} />
    </form>
  );
}
