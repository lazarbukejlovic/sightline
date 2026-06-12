import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-meta text-[11px] uppercase tracking-wide whitespace-nowrap",
  {
    variants: {
      variant: {
        secondary: "bg-secondary text-secondary-foreground",
        signal: "bg-signal/10 text-signal",
        teal: "bg-teal/10 text-teal",
        amber: "bg-amber/10 text-amber",
        outline: "border border-border text-muted-foreground",
      },
    },
    defaultVariants: { variant: "secondary" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { badgeVariants };
