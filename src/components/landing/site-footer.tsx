import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-12 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-ink text-paper">
            <span className="size-2.5 rounded-full bg-signal" />
          </span>
          <span className="font-display text-lg">Sightline</span>
        </div>
        <p className="font-meta text-xs text-muted-foreground">
          Monitors public pages only · respects robots · evidence-cited
        </p>
        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <Link href="/sign-in" className="transition-colors hover:text-foreground">
            Sign in
          </Link>
          <Link href="/sign-up" className="transition-colors hover:text-foreground">
            Start free
          </Link>
        </div>
      </div>
    </footer>
  );
}
