import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Editorial panel — light is the hero */}
      <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-border bg-secondary/40 p-10 lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(50% 40% at 20% 10%, rgba(229,72,77,0.07), transparent 60%)",
          }}
        />
        <Link href="/" className="relative flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-ink text-paper">
            <span className="size-2.5 rounded-full bg-signal" />
          </span>
          <span className="font-display text-xl">Sightline</span>
        </Link>

        <blockquote className="relative max-w-md">
          <p className="font-display text-3xl leading-snug tracking-tight">
            “The deals we lost weren’t to a better product — they were to a
            competitor move we found out about too late.”
          </p>
          <footer className="mt-4 font-meta text-xs uppercase tracking-wider text-muted-foreground">
            Why Sightline exists
          </footer>
        </blockquote>

        <p className="relative font-meta text-xs text-muted-foreground">
          Monitors public pages only · evidence-cited · confidence-scored
        </p>
      </aside>

      <main className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
