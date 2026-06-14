import { inngest, type ScanRequestedData } from "@/lib/inngest/client";
import { prisma } from "@/lib/db/prisma";
import {
  captureSnapshot,
  analyzeAndStoreChange,
  embedSnapshot,
  markScanned,
} from "@/lib/scan";
import { isDueForScan } from "@/lib/scan-schedule";
import { generateOrgDigest } from "@/lib/digest";
import { weeklyRange } from "@/lib/digest-range";
import { paidOrgIds } from "@/lib/billing/subscription";

const SCAN_EVENT = "source/scan.requested";

/**
 * Scheduled scanner. Runs hourly, but only fans out a scan event for sources
 * that are actually DUE under their cadence + the hard 12h floor (see
 * src/lib/scan-schedule.ts). Hourly cadence keeps latency low without ever
 * scanning a given source more than the floor allows.
 */
export const scheduledScan = inngest.createFunction(
  {
    id: "scheduled-scan",
    name: "Scheduled scan (per source cadence)",
    triggers: [{ cron: "0 * * * *" }],
  },
  async ({ step }) => {
    const due = await step.run("select-due-sources", async () => {
      const [sources, paid] = await Promise.all([
        prisma.source.findMany({
          where: { isActive: true, NOT: { scanFrequency: "manual" } },
          select: {
            id: true,
            orgId: true,
            scanFrequency: true,
            isActive: true,
            lastScannedAt: true,
          },
        }),
        paidOrgIds(), // scheduled monitoring is a paid feature
      ]);
      const now = new Date();
      return sources
        .filter((s) => paid.has(s.orgId) && isDueForScan(s, now))
        .map((s): ScanRequestedData => ({ orgId: s.orgId, sourceId: s.id }));
    });

    if (due.length === 0) return { scheduled: 0 };

    await step.sendEvent(
      "fan-out-scans",
      due.map((d) => ({ name: SCAN_EVENT, data: d })),
    );

    return { scheduled: due.length };
  },
);

/**
 * Durable scan of a single source. Each AI-charging stage is its own
 * `step.run`, so Inngest memoizes completed steps: a retry resumes without
 * re-fetching, re-analyzing, or re-embedding what already succeeded — a retry
 * can't double-charge the AI APIs. When the content hash is unchanged, the
 * analyze/embed steps are never reached (no change = no spend).
 */
export const scanSourceFn = inngest.createFunction(
  {
    id: "scan-source",
    name: "Scan source (durable)",
    retries: 3,
    concurrency: { limit: 5 },
    // Collapse duplicate requests for the same source within a short window.
    idempotency: "event.data.sourceId",
    triggers: [{ event: SCAN_EVENT }],
  },
  async ({ event, step }) => {
    const { orgId, sourceId } = event.data as ScanRequestedData;

    const capture = await step.run("capture-snapshot", () =>
      captureSnapshot(orgId, sourceId),
    );

    if (capture.kind === "unchanged") {
      return { sourceId, changed: false };
    }

    const analysis = await step.run("analyze-change", () =>
      analyzeAndStoreChange(orgId, sourceId, capture),
    );

    await step.run("embed-snapshot", () =>
      embedSnapshot(
        orgId,
        capture.meta.competitorId,
        capture.snapshotId,
        capture.normalized,
      ),
    );

    await step.run("mark-scanned", () => markScanned(sourceId));

    return {
      sourceId,
      changed: true,
      meaningful: analysis.meaningful,
      changeId: analysis.changeId,
      lowConfidence: analysis.confidence < 0.6,
    };
  },
);

/**
 * Weekly digest. Runs Mondays 09:00 UTC. Generates a per-org summary of the
 * last 7 days of changes. Each org is its own durable step (idempotent upsert),
 * so a retry never duplicates or double-charges.
 */
export const weeklyDigest = inngest.createFunction(
  {
    id: "weekly-digest",
    name: "Weekly digest (per org)",
    triggers: [{ cron: "0 9 * * 1" }],
  },
  async ({ step }) => {
    const orgs = await step.run("list-orgs", async () => {
      const [all, paid] = await Promise.all([
        prisma.organization.findMany({ select: { id: true } }),
        paidOrgIds(), // weekly digest is a paid feature
      ]);
      return all.filter((o) => paid.has(o.id));
    });

    const range = weeklyRange(new Date());

    for (const org of orgs) {
      await step.run(`digest-${org.id}`, () => generateOrgDigest(org.id, range));
    }

    return { orgs: orgs.length };
  },
);

export const functions = [scheduledScan, scanSourceFn, weeklyDigest];
