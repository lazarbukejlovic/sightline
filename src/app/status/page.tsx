import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { embeddingsConfigured } from "@/lib/ai/models";
import { stripeConfigured } from "@/lib/billing/stripe";
import { liveblocksConfigured } from "@/lib/liveblocks/server";
import { rateLimitConfigured } from "@/lib/ratelimit";

export const metadata: Metadata = { title: "Status · Sightline" };
export const revalidate = 30;

/**
 * Public status / metrics page. Shows system health + aggregate, non-sensitive
 * platform metrics (counts only — never per-org data). No auth required.
 */
export default async function StatusPage() {
  let dbOk = true;
  let metrics = { competitors: 0, sources: 0, changes: 0, orgs: 0 };
  try {
    const [competitors, sources, changes, orgs] = await Promise.all([
      prisma.competitor.count(),
      prisma.source.count(),
      prisma.change.count(),
      prisma.organization.count(),
    ]);
    metrics = { competitors, sources, changes, orgs };
  } catch {
    dbOk = false;
  }

  const subsystems: { name: string; ok: boolean; note: string }[] = [
    { name: "Database", ok: dbOk, note: dbOk ? "operational" : "unreachable" },
    { name: "AI reasoning", ok: true, note: "Anthropic" },
    {
      name: "Embeddings / RAG",
      ok: embeddingsConfigured(),
      note: embeddingsConfigured() ? "operational" : "degraded",
    },
    {
      name: "Real-time collaboration",
      ok: liveblocksConfigured(),
      note: liveblocksConfigured() ? "operational" : "degraded",
    },
    {
      name: "Billing",
      ok: stripeConfigured(),
      note: stripeConfigured() ? "operational" : "degraded",
    },
    {
      name: "Rate limiting",
      ok: true,
      note: rateLimitConfigured() ? "redis" : "in-memory",
    },
  ];

  const allOk = subsystems.every((s) => s.ok);

  return (
    <div className="min-h-dvh bg-background">
      <div aria-hidden className="h-0.5 w-full bg-signal" />
      <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-16">
        <header className="flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex size-7 items-center justify-center rounded-md bg-ink text-paper">
              <span className="size-2.5 rounded-full bg-signal" />
            </span>
            <span className="font-display text-xl tracking-tight">Sightline</span>
          </Link>
          <span className="rule-eyebrow text-[10px] text-muted-foreground">
            System status
          </span>
        </header>

        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-5 shadow-sm">
          <span
            className={`size-3 rounded-full animate-breathe ${allOk ? "bg-teal" : "bg-amber"}`}
            aria-hidden
          />
          <div>
            <h1 className="font-display text-2xl tracking-tight">
              {allOk ? "All systems operational" : "Partial degradation"}
            </h1>
            <p className="font-meta text-xs text-muted-foreground">
              Live · refreshes every 30s
            </p>
          </div>
        </div>

        <section className="flex flex-col gap-3">
          <h2 className="rule-eyebrow text-[10px] text-muted-foreground">
            Subsystems
          </h2>
          <ul className="overflow-hidden rounded-xl border border-border shadow-sm">
            {subsystems.map((s, i) => (
              <li
                key={s.name}
                className={`flex items-center justify-between gap-3 px-4 py-3 ${i % 2 === 1 ? "bg-secondary/20" : "bg-card"}`}
              >
                <span className="flex items-center gap-2.5">
                  <span
                    className={`size-2 rounded-full ${s.ok ? "bg-teal" : "bg-amber"}`}
                    aria-hidden
                  />
                  <span className="text-sm">{s.name}</span>
                </span>
                <span className="font-meta text-[11px] uppercase tracking-wide text-muted-foreground">
                  {s.note}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="rule-eyebrow text-[10px] text-muted-foreground">
            Platform metrics
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: "Organizations", value: metrics.orgs },
              { label: "Competitors", value: metrics.competitors },
              { label: "Sources", value: metrics.sources },
              { label: "Changes detected", value: metrics.changes },
            ].map((m) => (
              <div
                key={m.label}
                className="rounded-xl border border-border bg-card p-4 shadow-sm"
              >
                <p className="rule-eyebrow text-[9px] text-muted-foreground">
                  {m.label}
                </p>
                <p className="mt-1 font-display text-2xl tabular-nums leading-tight">
                  {m.value.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
          <p className="font-meta text-[11px] text-muted-foreground">
            Aggregate counts only — no per-organization data is exposed.
          </p>
        </section>
      </div>
    </div>
  );
}
