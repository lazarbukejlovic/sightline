import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Crafted empty state with character: a radar-"scope" medallion (concentric
 * rings + sweep tick on a faint grid), an editorial title, grounded copy, an
 * optional monospace hint line (intelligence-briefing texture), and an action.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  hint,
  children,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description: React.ReactNode;
  hint?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col items-center overflow-hidden rounded-xl border border-dashed border-border bg-secondary/30 px-6 py-14 text-center",
        className,
      )}
    >
      {/* faint scope grid backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.5]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 50% 42%, color-mix(in srgb, var(--ink) 6%, transparent) 0 1px, transparent 1px), radial-gradient(circle at 50% 42%, transparent 38px, color-mix(in srgb,var(--ink) 5%,transparent) 38px 39px, transparent 39px), radial-gradient(circle at 50% 42%, transparent 64px, color-mix(in srgb,var(--ink) 4%,transparent) 64px 65px, transparent 65px)",
          backgroundSize: "22px 22px, 100% 100%, 100% 100%",
        }}
      />

      {Icon && (
        <span className="relative mb-5 flex size-14 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm">
          <span
            aria-hidden
            className="absolute inset-0 rounded-full ring-1 ring-inset ring-signal/15"
          />
          <span
            aria-hidden
            className="absolute -inset-2 rounded-full border border-dashed border-border/70"
          />
          <Icon className="size-6" strokeWidth={1.5} />
        </span>
      )}

      <h3 className="relative font-display text-2xl tracking-tight text-balance">
        {title}
      </h3>
      <p className="relative mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground text-balance">
        {description}
      </p>

      {hint && (
        <p className="relative mt-4 rounded-full border border-border bg-card/70 px-3 py-1 font-meta text-[11px] uppercase tracking-wider text-muted-foreground">
          {hint}
        </p>
      )}

      {children && <div className="relative mt-5">{children}</div>}
    </div>
  );
}
