import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware already guards /app, but verify server-side as defense in depth.
  if (!user) {
    redirect("/sign-in?next=/app");
  }

  const email = user.email ?? "Signed in";

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/app" className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-md bg-ink text-paper">
              <span className="size-2.5 rounded-full bg-signal" />
            </span>
            <span className="font-display text-xl tracking-tight">
              Sightline
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <span className="hidden font-meta text-xs text-muted-foreground sm:inline">
              {email}
            </span>
            <form action="/auth/sign-out" method="post">
              <Button type="submit" variant="outline" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
