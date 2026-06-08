"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Confidence rendered as a red→amber→green meter — never a bare number.
 * `value` is 0–1.
 */
export function ConfidenceMeter({
  value,
  className,
  animate = true,
}: {
  value: number;
  className?: string;
  animate?: boolean;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  const hue = value < 0.5 ? "#e5484d" : value < 0.75 ? "#f5a524" : "#137a6e";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-border">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: hue }}
          initial={animate ? { width: 0 } : false}
          whileInView={animate ? { width: `${pct}%` } : undefined}
          animate={animate ? undefined : { width: `${pct}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />
      </div>
      <span className="font-meta text-xs tabular-nums text-muted-foreground">
        {pct}% confidence
      </span>
    </div>
  );
}
