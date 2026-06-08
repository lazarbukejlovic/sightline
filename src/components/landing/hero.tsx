"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { DemoFeed } from "@/components/landing/demo-feed";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* warm paper gradient wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 50% at 15% 0%, rgba(229,72,77,0.06), transparent 60%), radial-gradient(50% 40% at 90% 10%, rgba(19,122,110,0.06), transparent 60%)",
        }}
      />
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:py-28">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 font-meta text-xs text-muted-foreground"
          >
            <span className="size-1.5 animate-pulse rounded-full bg-signal" />
            Live competitive intelligence
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="mt-5 font-display text-5xl leading-[1.05] tracking-tight sm:text-6xl"
          >
            Know what your competitors changed{" "}
            <span className="italic text-signal">before</span> your deals do.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.12 }}
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
            transition={{ duration: 0.6, delay: 0.18 }}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <Button asChild size="lg">
              <Link href="/sign-up">Start monitoring free</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#how">See how it works</a>
            </Button>
          </motion.div>

          <p className="mt-4 font-meta text-xs text-muted-foreground">
            Only public pages · evidence-cited · no credit card to start
          </p>
        </div>

        {/* Live intel feed preview */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="relative"
        >
          <div className="rounded-2xl border border-border bg-secondary/40 p-3 shadow-xl shadow-black/[0.04]">
            <div className="mb-3 flex items-center justify-between px-2 pt-1">
              <span className="font-meta text-xs uppercase tracking-wider text-muted-foreground">
                Intel Feed
              </span>
              <span className="font-meta text-xs text-muted-foreground">
                3 changes today
              </span>
            </div>
            <DemoFeed />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
