import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/app/(auth)/auth-form";
import { signUp } from "@/app/(auth)/actions";

export const metadata: Metadata = {
  title: "Start free · Sightline",
};

export default function SignUpPage() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-3xl tracking-tight">
          Start watching competitors
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create your workspace — track your first competitor free.
        </p>
      </header>

      <AuthForm mode="sign-up" action={signUp} />

      <p className="text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/sign-in"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
