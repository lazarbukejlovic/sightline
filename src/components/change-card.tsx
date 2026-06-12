"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ConfidenceMeter } from "@/components/confidence-meter";
import { RedlineDiff, countDiff } from "@/components/redline-diff";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DURATION, EASE_OUT } from "@/lib/motion";

export type ChangeCategory =
  | "pricing"
  | "product"
  | "positioning"
  | "hiring"
  | "funding"
  | "other";

export interface ChangeCardData {
  competitor: string;
  initials: string;
  category: ChangeCategory;
  impact: "low" | "medium" | "high";
  confidence: number;
  summary: string;
  whyItMatters: string;
  source: string;
  detectedAt: string;
  /** Optional redline evidence (existing diffExcerpt data). */
  diff?: string | null;
}

const categoryLabel: Record<ChangeCategory, string> = {
  pricing: "Pricing",
  product: "Product",
  positioning: "Positioning",
  hiring: "Hiring",
  funding: "Funding",
  other: "Other",
};

const impactRail: Record<ChangeCardData["impact"], string> = {
  high: "border-l-signal",
  medium: "border-l-amber/70",
  low: "border-l-border",
};

export function ChangeCard({
  data,
  index = 0,
  animate = true,
}: {
  data: ChangeCardData;
  index?: number;
  animate?: boolean;
}) {
  const highImpact = data.impact === "high";
  const [showEvidence, setShowEvidence] = useState(false);
  const hasDiff = Boolean(data.diff && data.diff.trim().length > 0);
  const counts = hasDiff ? countDiff(data.diff!) : null;

  return (
    <motion.article
      initial={animate ? { opacity: 0, y: 16 } : false}
      animate={animate ? { opacity: 1, y: 0 } : undefined}
      transition={{
        duration: DURATION.base,
        delay: Math.min(index * 0.06, 0.36),
        ease: EASE_OUT,
      }}
      className={cn(
        "rounded-xl border border-l-4 bg-card p-5 shadow-sm transition-shadow hover:shadow-md",
        impactRail[data.impact],
        highImpact && "bg-gradient-to-r from-signal/[0.04] to-transparent",
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary font-meta text-xs font-semibold text-secondary-foreground">
            {data.initials}
          </span>
          <div className="min-w-0">
            <h3 className="truncate font-display text-lg leading-tight">
              {data.competitor}
            </h3>
            <p className="truncate font-meta text-xs text-muted-foreground">
              {data.detectedAt} · {data.source}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <Badge variant="secondary">{categoryLabel[data.category]}</Badge>
          {highImpact && <Badge variant="signal">High impact</Badge>}
        </div>
      </header>

      <p className="mt-4 text-[15px] leading-relaxed text-foreground">
        {data.summary}
      </p>

      <div className="mt-3 rounded-md border-l-2 border-teal/50 bg-teal/[0.04] py-2 pl-3 pr-2.5">
        <p className="rule-eyebrow text-[9px] text-teal">Analyst note · why it matters</p>
        <p className="mt-0.5 text-sm leading-relaxed text-foreground/90">
          {data.whyItMatters}
        </p>
      </div>

      <footer className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <ConfidenceMeter value={data.confidence} animate={animate} />
        {counts && (
          <button
            type="button"
            onClick={() => setShowEvidence((v) => !v)}
            aria-expanded={showEvidence}
            className={cn(
              "group inline-flex items-center gap-2 rounded-full border px-2.5 py-1 font-meta text-[11px] uppercase tracking-wide transition-colors",
              showEvidence
                ? "border-ink/30 bg-secondary text-foreground"
                : "border-border bg-card text-muted-foreground hover:border-ink/30 hover:text-foreground",
            )}
          >
            <span className="flex gap-1 tabular-nums">
              <span className="text-signal">−{counts.removed}</span>
              <span className="text-teal">+{counts.added}</span>
            </span>
            <span aria-hidden className="text-border">|</span>
            <span>{showEvidence ? "Hide redline" : "Redline"}</span>
          </button>
        )}
      </footer>

      <AnimatePresence initial={false}>
        {hasDiff && showEvidence && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: DURATION.base, ease: EASE_OUT }}
            className="overflow-hidden"
          >
            <div className="pt-4">
              <RedlineDiff
                diff={data.diff!}
                highImpact={highImpact}
                source={data.source}
                capturedAt={data.detectedAt}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}
