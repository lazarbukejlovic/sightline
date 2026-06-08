"use client";

import { motion } from "framer-motion";

const STEPS = [
  {
    n: "01",
    title: "Add a competitor",
    copy: "Point Sightline at the public pages that matter — pricing, changelog, blog, news, careers.",
  },
  {
    n: "02",
    title: "We watch & diff",
    copy: "Scheduled scans snapshot each page and compare against the last known version on normalized text.",
  },
  {
    n: "03",
    title: "Get cited intel",
    copy: "Meaningful changes become feed cards with category, impact, confidence, and a 'why it matters' line.",
  },
  {
    n: "04",
    title: "Share battlecards",
    copy: "Promote intel into collaborative battlecards your team keeps current together, in real time.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="border-y border-border bg-secondary/30">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-2xl">
          <p className="font-meta text-xs uppercase tracking-wider text-signal">
            How it works
          </p>
          <h2 className="mt-3 font-display text-4xl tracking-tight">
            A radar for your market, always on.
          </h2>
        </div>

        <ol className="mt-12 grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-4">
          {STEPS.map((s, i) => (
            <motion.li
              key={s.n}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: i * 0.08 }}
              className="bg-card p-6"
            >
              <span className="font-meta text-sm text-signal">{s.n}</span>
              <h3 className="mt-3 font-display text-xl">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {s.copy}
              </p>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}
