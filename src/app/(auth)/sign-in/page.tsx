import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/app/(auth)/auth-form";
import { signIn } from "@/app/(auth)/actions";

export const metadata: Metadata = {
  title: "Sign in · Sightline",
};

export default function SignInPage() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-3xl tracking-tight">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in to your competitive intel workspace.
        </p>
      </header>

      <AuthForm mode="sign-in" action={signIn} />

      <p className="text-sm text-muted-foreground">
        New to Sightline?{" "}
        <Link
          href="/sign-up"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}
