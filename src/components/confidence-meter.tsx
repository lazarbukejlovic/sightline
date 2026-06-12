"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { DURATION, EASE_OUT } from "@/lib/motion";

/**
 * Confidence rendered as a red→amber→green meter — never a bare number.
 * Fills on mount. `value` is 0–1. Honors prefers-reduced-motion (width is not a
 * transform, so we gate it explicitly rather than rely on MotionConfig).
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
  const reduce = useReducedMotion();
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  const hue =
    value < 0.5 ? "var(--signal)" : value < 0.75 ? "var(--amber)" : "var(--teal)";
  const shouldAnimate = animate && !reduce;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-border">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: hue }}
          initial={shouldAnimate ? { width: 0 } : false}
          animate={{ width: `${pct}%` }}
          transition={{ duration: DURATION.slow, ease: EASE_OUT }}
        />
      </div>
      <span className="font-meta text-xs tabular-nums text-muted-foreground">
        {pct}% confidence
      </span>
    </div>
  );
}
