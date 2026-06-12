import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { requireOrgContext } from "@/lib/org/context";
import { REVIEW_CONFIDENCE_THRESHOLD } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { NavLink } from "./_components/nav-link";

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
    <div className="relative min-h-dvh bg-background">
      {/* command-desk backdrop */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 dossier-grid opacity-[0.45]" />
        <div className="absolute inset-0 paper-vignette" />
      </div>

      {/* signal hairline at the very top — the product's signature edge */}
      <div aria-hidden className="h-0.5 w-full bg-signal" />

      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex min-w-0 items-center gap-4 sm:gap-8">
            <Link href="/app" className="flex shrink-0 items-center gap-2.5">
              <span className="flex size-7 items-center justify-center rounded-md bg-ink text-paper">
                <span className="size-2.5 rounded-full bg-signal" />
              </span>
              <span className="flex flex-col leading-none">
                <span className="font-display text-xl tracking-tight">
                  Sightline
                </span>
                <span className="rule-eyebrow text-[8px] text-muted-foreground">
                  Intelligence desk
                </span>
              </span>
            </Link>

            <nav className="flex items-center gap-5 overflow-x-auto whitespace-nowrap text-sm [scrollbar-width:none]">
              <NavLink href="/app" exact>
                Intel Feed
              </NavLink>
              <NavLink href="/app/review">
                Review Queue
                {reviewCount > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-signal px-1 font-meta text-[10px] font-semibold text-white">
                    {reviewCount}
                  </span>
                )}
              </NavLink>
              <NavLink href="/app/digests">Digests</NavLink>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-1.5 font-meta text-xs text-muted-foreground md:flex">
              <span className="size-1.5 rounded-full bg-teal" />
              <span className="max-w-[20ch] truncate">{email}</span>
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
