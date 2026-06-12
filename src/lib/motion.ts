import type { Variants, Transition } from "framer-motion";

/**
 * Shared motion tokens for a consistent, meaningful motion system. Mirrors the
 * CSS custom properties in globals.css. Framer honors prefers-reduced-motion
 * globally via <MotionProvider> (MotionConfig reducedMotion="user").
 */
export const DURATION = {
  fast: 0.18,
  base: 0.32,
  slow: 0.6,
} as const;

/** "Settle" easing — decisive then gentle, the signature of premium motion. */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;
export const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;

export const transition = {
  base: { duration: DURATION.base, ease: EASE_OUT } satisfies Transition,
  fast: { duration: DURATION.fast, ease: EASE_OUT } satisfies Transition,
  slow: { duration: DURATION.slow, ease: EASE_OUT } satisfies Transition,
};

/** A single element fading + settling up into place. */
export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: transition.base },
};

/** A quieter fade (no travel) for text/answer surfaces. */
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: transition.base },
};

/** Container that staggers its children settling in (feed, citations, lists). */
export function staggerContainer(stagger = 0.06, delayChildren = 0): Variants {
  return {
    hidden: {},
    show: {
      transition: { staggerChildren: stagger, delayChildren },
    },
  };
}

/** Child item used inside a staggerContainer. */
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: transition.base },
};
