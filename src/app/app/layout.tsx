import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { requireOrgContext } from "@/lib/org/context";
import { REVIEW_CONFIDENCE_THRESHOLD } from "@/lib/constants";
import { Button } from "@/components/ui/button";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Resolves the user (redirects to sign-in if absent) and bootstraps the org.
  const { user, orgId } = await requireOrgContext();

  const reviewCount = await prisma.change.count({
    where: {
      orgId,
      status: "new",
      confidence: { lt: REVIEW_CONFIDENCE_THRESHOLD },
    },
  });

  const email = user.email ?? "Signed in";

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-8">
            <Link href="/app" className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-md bg-ink text-paper">
                <span className="size-2.5 rounded-full bg-signal" />
              </span>
              <span className="font-display text-xl tracking-tight">
                Sightline
              </span>
            </Link>

            <nav className="hidden items-center gap-6 text-sm text-muted-foreground sm:flex">
              <Link href="/app" className="transition-colors hover:text-foreground">
                Intel Feed
              </Link>
              <Link
                href="/app/review"
                className="flex items-center gap-1.5 transition-colors hover:text-foreground"
              >
                Review Queue
                {reviewCount > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-signal px-1 font-meta text-[10px] font-semibold text-white">
                    {reviewCount}
                  </span>
                )}
              </Link>
              <Link
                href="/app/digests"
                className="transition-colors hover:text-foreground"
              >
                Digests
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden font-meta text-xs text-muted-foreground md:inline">
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
