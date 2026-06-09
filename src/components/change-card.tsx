"use client";

import { motion } from "framer-motion";
import { ConfidenceMeter } from "@/components/confidence-meter";
import { cn } from "@/lib/utils";

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
}

const categoryLabel: Record<ChangeCategory, string> = {
  pricing: "Pricing",
  product: "Product",
  positioning: "Positioning",
  hiring: "Hiring",
  funding: "Funding",
  other: "Other",
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

  return (
    <motion.article
      initial={animate ? { opacity: 0, y: 16 } : false}
      whileInView={animate ? { opacity: 1, y: 0 } : undefined}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, delay: index * 0.12, ease: "easeOut" }}
      className={cn(
        "rounded-xl border bg-card p-5 shadow-sm",
        highImpact && "ring-1 ring-signal/30",
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-md bg-secondary font-meta text-xs font-semibold text-secondary-foreground">
            {data.initials}
          </span>
          <div>
            <h3 className="font-display text-lg leading-tight">
              {data.competitor}
            </h3>
            <p className="font-meta text-xs text-muted-foreground">
              {data.detectedAt} · {data.source}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className="rounded-full bg-secondary px-2.5 py-0.5 font-meta text-[11px] uppercase tracking-wide text-secondary-foreground">
            {categoryLabel[data.category]}
          </span>
          {highImpact && (
            <span className="rounded-full bg-signal/10 px-2.5 py-0.5 font-meta text-[11px] uppercase tracking-wide text-signal">
              High impact
            </span>
          )}
        </div>
      </header>

      <p className="mt-4 text-[15px] leading-relaxed text-foreground">
        {data.summary}
      </p>

      <p className="mt-2 border-l-2 border-signal/40 pl-3 text-sm italic text-muted-foreground">
        Why it matters: {data.whyItMatters}
      </p>

      <footer className="mt-4">
        <ConfidenceMeter value={data.confidence} animate={animate} />
      </footer>
    </motion.article>
  );
}
