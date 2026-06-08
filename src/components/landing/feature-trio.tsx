"use client";

import { motion } from "framer-motion";
import { Radar, ScanSearch, Share2 } from "lucide-react";

const FEATURES = [
  {
    icon: Radar,
    title: "Detect",
    copy: "We snapshot competitors' public pages on a schedule, diff each one against history, and surface only what meaningfully changed — no noise.",
  },
  {
    icon: ScanSearch,
    title: "Explain",
    copy: "An agent classifies each change, scores impact and confidence, and writes a one-line 'why it matters' — every claim cited, low-confidence routed to a human.",
  },
  {
    icon: Share2,
    title: "Share",
    copy: "Intel flows into live, collaborative battlecards your whole GTM team edits together — so sales always has the current counter.",
  },
];

export function FeatureTrio() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-6 py-20">
      <div className="max-w-2xl">
        <p className="font-meta text-xs uppercase tracking-wider text-signal">
          The loop
        </p>
        <h2 className="mt-3 font-display text-4xl tracking-tight">
          Detect, explain, share — on autopilot.
        </h2>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {FEATURES.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
            className="rounded-xl border border-border bg-card p-6 shadow-sm"
          >
            <span className="flex size-10 items-center justify-center rounded-lg bg-secondary text-foreground">
              <f.icon className="size-5" />
            </span>
            <h3 className="mt-4 font-display text-2xl">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {f.copy}
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
