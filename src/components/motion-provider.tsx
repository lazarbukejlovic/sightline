"use client";

import { MotionConfig } from "framer-motion";

/**
 * App-wide motion configuration. `reducedMotion="user"` makes Framer Motion
 * respect the OS prefers-reduced-motion setting everywhere — transform/layout
 * animations are neutralized while opacity still fades, so motion is never
 * jarring for users who opt out.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
