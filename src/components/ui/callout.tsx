import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const calloutVariants = cva(
  "rounded-md border px-3 py-2 text-sm",
  {
    variants: {
      tone: {
        error: "border-signal/30 bg-signal/5 text-signal",
        success: "border-teal/30 bg-teal/5 text-teal",
        info: "border-border bg-secondary/40 text-muted-foreground",
      },
    },
    defaultVariants: { tone: "info" },
  },
);

export interface CalloutProps
  extends React.HTMLAttributes<HTMLParagraphElement>,
    VariantProps<typeof calloutVariants> {}

/** On-brand inline alert/notice. Use `tone` for error / success / info. */
export function Callout({ className, tone, ...props }: CalloutProps) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn(calloutVariants({ tone }), className)}
      {...props}
    />
  );
}
