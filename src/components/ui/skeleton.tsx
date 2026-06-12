import { cn } from "@/lib/utils";

/** A shimmering placeholder block. Use instead of spinners while loading. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton", className)} />;
}
