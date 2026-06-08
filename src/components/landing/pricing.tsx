"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TIERS = [
  {
    name: "Free",
    price: "$0",
    cadence: "forever",
    blurb: "Track one competitor with manual scans.",
    features: ["1 competitor", "Manual “Scan now”", "Cited change feed"],
    cta: "Start free",
    featured: false,
  },
  {
    name: "Pro",
    price: "$49",
    cadence: "per seat / month",
    blurb: "Scheduled monitoring for the whole GTM team.",
    features: [
      "Unlimited competitors",
      "Scheduled monitoring + digests",
      "Collaborative battlecards",
      "Ask Sightline RAG",
    ],
    cta: "Start free trial",
    featured: true,
  },
  {
    name: "Scale",
    price: "Custom",
    cadence: "let’s talk",
    blurb: "Advanced controls, SSO, and usage at scale.",
    features: ["SSO & audit log", "Priority monitoring", "Usage-based AI", "SLA"],
    cta: "Contact sales",
    featured: false,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="mx-auto max-w-6xl px-6 py-20">
      <div className="max-w-2xl">
        <p className="font-meta text-xs uppercase tracking-wider text-signal">
          Pricing
        </p>
        <h2 className="mt-3 font-display text-4xl tracking-tight">
          Start free. Scale when the intel pays for itself.
        </h2>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {TIERS.map((tier, i) => (
          <motion.div
            key={tier.name}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
            className={cn(
              "flex flex-col rounded-xl border bg-card p-6 shadow-sm",
              tier.featured && "border-signal/40 ring-1 ring-signal/20",
            )}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-2xl">{tier.name}</h3>
              {tier.featured && (
                <span className="rounded-full bg-signal/10 px-2.5 py-0.5 font-meta text-[11px] uppercase tracking-wide text-signal">
                  Popular
                </span>
              )}
            </div>
            <div className="mt-4 flex items-baseline gap-1.5">
              <span className="font-display text-4xl">{tier.price}</span>
              <span className="font-meta text-xs text-muted-foreground">
                {tier.cadence}
              </span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{tier.blurb}</p>

            <ul className="mt-6 flex flex-1 flex-col gap-3 text-sm">
              {tier.features.map((feat) => (
                <li key={feat} className="flex items-start gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-teal" />
                  <span>{feat}</span>
                </li>
              ))}
            </ul>

            <Button
              asChild
              className="mt-6"
              variant={tier.featured ? "signal" : "outline"}
            >
              <Link href="/sign-up">{tier.cta}</Link>
            </Button>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
