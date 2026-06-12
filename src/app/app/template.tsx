"use client";

import { motion } from "framer-motion";
import { DURATION, EASE_OUT } from "@/lib/motion";

/**
 * Intentional (not instant) route transitions inside the app. `template.tsx`
 * re-mounts on every navigation, so each page settles in. Respects
 * prefers-reduced-motion via the app-wide MotionConfig.
 */
export default function AppTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: DURATION.base, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}
