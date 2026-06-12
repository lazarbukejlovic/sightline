"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { DURATION, EASE_OUT } from "@/lib/motion";

interface DiffLine {
  kind: "add" | "remove" | "context";
  text: string;
}

function parseDiff(diff: string): DiffLine[] {
  return diff
    .split("\n")
    .filter((l) => l.length > 0)
    .map((l) => {
      if (l.startsWith("+")) return { kind: "add" as const, text: l.slice(1).trimStart() };
      if (l.startsWith("-")) return { kind: "remove" as const, text: l.slice(1).trimStart() };
      return { kind: "context" as const, text: l };
    });
}

/** Counts of removed/added lines — used by the change-card affordance. */
export function countDiff(diff: string): { removed: number; added: number } {
  let removed = 0;
  let added = 0;
  for (const l of diff.split("\n")) {
    if (l.startsWith("+")) added++;
    else if (l.startsWith("-")) removed++;
  }
  return { removed, added };
}

// Inline styles for values Tailwind arbitrary classes parse unreliably
// (nested color-mix / repeating-gradient).
const LEDGER_BG =
  "repeating-linear-gradient(var(--paper-2) 0px, var(--paper-2) 27px, color-mix(in srgb, var(--ink) 5%, transparent) 27px, color-mix(in srgb, var(--ink) 5%, transparent) 28px)";

const TEXT_COLOR: Record<DiffLine["kind"], string | undefined> = {
  remove: "color-mix(in srgb, var(--signal) 78%, var(--ink))",
  add: "color-mix(in srgb, var(--teal) 78%, var(--ink))",
  context: undefined,
};

/**
 * Redline-style change diff — the signature evidence surface. A "redlined
 * dossier": ledger-ruled rows on warm paper, a colored rail per line (signal
 * removals / teal additions), monospace throughout, a perforated header tab,
 * and a highlight that sweeps across on open. Deliberately unlike any other
 * surface in the app.
 */
export function RedlineDiff({
  diff,
  highImpact = false,
  source,
  capturedAt,
  className,
}: {
  diff: string;
  highImpact?: boolean;
  /** Source host the snapshot came from (evidence provenance). */
  source?: string;
  /** When the change was detected (relative). */
  capturedAt?: string;
  className?: string;
}) {
  const lines = parseDiff(diff);
  if (lines.length === 0) return null;

  const removed = lines.filter((l) => l.kind === "remove").length;
  const added = lines.filter((l) => l.kind === "add").length;

  return (
    <motion.figure
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.022 } } }}
      style={{ background: LEDGER_BG }}
      className={cn(
        "relative overflow-hidden rounded-lg border shadow-inner",
        highImpact ? "border-signal/35" : "border-border",
        className,
      )}
    >
      {/* sweep highlight on open */}
      <motion.div
        aria-hidden
        initial={{ x: "-120%" }}
        animate={{ x: "220%" }}
        transition={{ duration: DURATION.slow, ease: EASE_OUT, delay: 0.04 }}
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-1/3"
        style={{
          background:
            "linear-gradient(90deg, transparent, color-mix(in srgb, var(--signal) 14%, transparent), transparent)",
        }}
      />

      {/* header tab */}
      <figcaption className="flex items-center justify-between border-b border-dashed border-border bg-card/70 px-3 py-1.5">
        <span className="flex items-center gap-2">
          <span
            className={cn(
              "size-1.5 rounded-full",
              highImpact ? "bg-signal" : "bg-ink/40",
            )}
          />
          <span className="font-meta text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Redline · evidence
          </span>
        </span>
        <span className="font-meta text-[11px] tabular-nums">
          <span className="text-signal">−{removed}</span>{" "}
          <span className="text-teal">+{added}</span>
        </span>
      </figcaption>

      {/* provenance — snapshot source + capture time */}
      {(source || capturedAt) && (
        <div className="flex items-center gap-2 border-b border-dashed border-border/70 bg-card/40 px-3 py-1 font-meta text-[10px] text-muted-foreground">
          <span className="uppercase tracking-wider text-ink/40">Source</span>
          {source && <span className="truncate text-foreground/80">{source}</span>}
          {source && capturedAt && <span className="text-border">·</span>}
          {capturedAt && <span className="tabular-nums">{capturedAt}</span>}
          <span className="ml-auto uppercase tracking-wider text-ink/40">
            Snapshot diff
          </span>
        </div>
      )}

      <div className="relative max-h-72 overflow-auto">
        {lines.map((line, i) => (
          <motion.div
            key={i}
            variants={{
              hidden: { opacity: 0 },
              show: { opacity: 1, transition: { duration: DURATION.fast } },
            }}
            className={cn(
              "grid grid-cols-[1.5rem_2px_1fr] items-stretch gap-2 py-[3px] pr-3 font-mono text-xs leading-[21px]",
              line.kind === "remove" && "bg-signal/[0.06]",
              line.kind === "add" && "bg-teal/[0.06]",
            )}
          >
            <span
              className={cn(
                "select-none text-right tabular-nums",
                line.kind === "remove" && "text-signal",
                line.kind === "add" && "text-teal",
                line.kind === "context" && "text-ink/30",
              )}
              aria-hidden
            >
              {line.kind === "remove" ? "−" : line.kind === "add" ? "+" : ""}
            </span>
            <span
              aria-hidden
              className={cn(
                line.kind === "remove" && "bg-signal/60",
                line.kind === "add" && "bg-teal/60",
                line.kind === "context" && "bg-transparent",
              )}
            />
            <span
              className="min-w-0 whitespace-pre-wrap break-words"
              style={{ color: TEXT_COLOR[line.kind] }}
            >
              {line.text || " "}
            </span>
          </motion.div>
        ))}
      </div>
    </motion.figure>
  );
}
