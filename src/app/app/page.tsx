import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Overview · Sightline",
};

export default async function AppOverviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const name =
    (user?.user_metadata?.full_name as string | undefined) ??
    user?.email?.split("@")[0] ??
    "there";

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="font-meta text-xs uppercase tracking-wider text-signal">
          Overview
        </p>
        <h1 className="mt-2 font-display text-4xl tracking-tight">
          Welcome, {name}.
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Your competitive intel workspace is ready. The live Intel Feed,
          competitors, and collaborative battlecards arrive next — this is the
          Phase 0 foundation: auth, tenancy, and the design system.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Competitors tracked", value: "0", hint: "Add in Phase 1" },
          { label: "Changes detected", value: "0", hint: "Feed coming soon" },
          { label: "Review queue", value: "0", hint: "Low-confidence intel" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-border bg-card p-5 shadow-sm"
          >
            <p className="font-meta text-xs uppercase tracking-wide text-muted-foreground">
              {stat.label}
            </p>
            <p className="mt-2 font-display text-4xl tabular-nums">
              {stat.value}
            </p>
            <p className="mt-1 font-meta text-xs text-muted-foreground">
              {stat.hint}
            </p>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-dashed border-border bg-secondary/30 p-8 text-center">
        <h2 className="font-display text-2xl">Your Intel Feed is empty</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          In Phase 1 you’ll add a competitor, point Sightline at their public
          pages, and run your first scan. Detected changes will stream in here
          with citations and a confidence score.
        </p>
      </section>
    </div>
  );
}
