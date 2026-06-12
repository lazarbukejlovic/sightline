"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { DemoFeed } from "@/components/landing/demo-feed";
import { DURATION, EASE_OUT } from "@/lib/motion";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* command-desk backdrop: dossier grid + warm vignette */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 dossier-grid opacity-[0.5]" />
        <div className="absolute inset-0 paper-vignette" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-border" />
      </div>

      <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:py-28">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DURATION.base, ease: EASE_OUT }}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 rule-eyebrow text-[11px] text-muted-foreground shadow-sm"
          >
            <span className="size-1.5 animate-pulse rounded-full bg-signal" />
            Competitive intelligence · live
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DURATION.slow, ease: EASE_OUT, delay: 0.05 }}
            className="mt-5 font-display text-5xl leading-[1.04] tracking-tight sm:text-6xl text-balance"
          >
            Know what your competitors changed{" "}
            <span className="italic text-signal">before</span> your deals do.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DURATION.slow, ease: EASE_OUT, delay: 0.12 }}
            className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground"
          >
            Sightline watches every public page your competitors ship — pricing,
            changelogs, news, hiring — detects what meaningfully changed, and
            explains <span className="text-foreground">why it matters</span> with
            cited evidence and a confidence score your team can trust.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DURATION.slow, ease: EASE_OUT, delay: 0.18 }}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <Button asChild size="lg">
              <Link href="/sign-up">Start monitoring free</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#how">See how it works</a>
            </Button>
          </motion.div>

          <p className="mt-5 font-meta text-xs text-muted-foreground">
            Only public pages · evidence-cited · no credit card to start
          </p>
        </div>

        {/* Live intel feed preview — framed as a console window */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION.slow, ease: EASE_OUT, delay: 0.1 }}
          className="relative"
        >
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-black/[0.06]">
            <div aria-hidden className="h-0.5 w-full bg-signal" />
            {/* window chrome */}
            <div className="flex items-center justify-between border-b border-border bg-secondary/50 px-4 py-2.5">
              <span className="flex items-center gap-2 rule-eyebrow text-[10px] text-muted-foreground">
                <span className="flex gap-1">
                  <span className="size-2 rounded-full bg-signal/70" />
                  <span className="size-2 rounded-full bg-amber/60" />
                  <span className="size-2 rounded-full bg-teal/60" />
                </span>
                Sightline · Intel Feed
              </span>
              <span className="flex items-center gap-1.5 font-meta text-[10px] text-muted-foreground">
                <span className="size-1.5 animate-pulse rounded-full bg-teal" />
                3 changes today
              </span>
            </div>
            <div className="relative bg-secondary/30 p-3">
              <div aria-hidden className="dossier-grid pointer-events-none absolute inset-0 opacity-40" />
              <div className="relative">
                <DemoFeed />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
