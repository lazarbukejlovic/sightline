import "server-only";
import { prisma } from "@/lib/db/prisma";
import { fetchPage } from "@/lib/firecrawl";
import {
  normalizeContent,
  contentHash,
  chunkText,
  diffExcerpt,
} from "@/lib/text/normalize";
import { analyzeChange } from "@/lib/ai/analyze";
import { maybeSuggestBattlecard } from "@/lib/ai/suggest";
import {
  embedTexts,
  toVectorLiteral,
  embeddingsConfigured,
  isQuotaError,
} from "@/lib/ai/embeddings";
import { reasoningModelId, embeddingModelId } from "@/lib/ai/models";
import { logAiRun } from "@/lib/ai/runs";

const MAX_CHUNKS = 20;

const EMBEDDINGS_UNAVAILABLE_NOTE =
  "Embeddings skipped because OpenAI billing/quota is unavailable.";

// ─────────────────────────────────────────────────────────────
// Composable steps (shared by manual scan + the durable Inngest job).
// Each is independently retryable; AI-charging steps are only reached when the
// content hash actually changed, so an unchanged page never costs anything.
// ─────────────────────────────────────────────────────────────

export interface SourceMeta {
  competitorId: string;
  competitorName: string;
  sourceType: string;
  sourceUrl: string;
}

export type CaptureResult =
  | { kind: "unchanged"; snapshotId: string }
  | {
      kind: "captured";
      snapshotId: string;
      previousSnapshotId: string | null;
      isFirstSnapshot: boolean;
      diff: string;
      normalized: string;
      meta: SourceMeta;
    };

/**
 * Step 1 — fetch, normalize, hash, and compare against the last snapshot.
 * On no change, updates `last_scanned_at` and returns early (NO AI spend).
 * On change, writes a new snapshot and returns the data needed to analyze.
 */
export async function captureSnapshot(
  orgId: string,
  sourceId: string,
): Promise<CaptureResult> {
  const source = await prisma.source.findFirst({
    where: { id: sourceId, orgId },
    include: { competitor: { select: { id: true, name: true } } },
  });
  if (!source) throw new Error("Source not found in this organization.");

  const page = await fetchPage(source.url);
  const normalized = normalizeContent(page.text);
  const hash = contentHash(normalized);

  const previous = await prisma.sourceSnapshot.findFirst({
    where: { sourceId, orgId },
    orderBy: { fetchedAt: "desc" },
    select: { id: true, contentText: true, contentHash: true },
  });

  if (previous && previous.contentHash === hash) {
    await prisma.source.update({
      where: { id: sourceId },
      data: { lastScannedAt: new Date() },
    });
    return { kind: "unchanged", snapshotId: previous.id };
  }

  const snapshot = await prisma.sourceSnapshot.create({
    data: { orgId, sourceId, contentText: normalized, contentHash: hash, rawUrl: source.url },
    select: { id: true },
  });

  const isFirstSnapshot = !previous;
  const diff = previous
    ? diffExcerpt(previous.contentText, normalized)
    : normalized.slice(0, 2000);

  return {
    kind: "captured",
    snapshotId: snapshot.id,
    previousSnapshotId: previous?.id ?? null,
    isFirstSnapshot,
    diff,
    normalized,
    meta: {
      competitorId: source.competitor.id,
      competitorName: source.competitor.name,
      sourceType: source.type,
      sourceUrl: source.url,
    },
  };
}

export interface AnalyzeStepResult {
  changeId: string | null;
  meaningful: boolean;
  confidence: number;
}

/**
 * Step 2 — durable analysis. Structured LLM output → `changes` row (when
 * meaningful). Always logs an `ai_run`. Low confidence (< 0.6) still writes a
 * change with status=new so it surfaces in the Review Queue.
 */
export async function analyzeAndStoreChange(
  orgId: string,
  sourceId: string,
  capture: Extract<CaptureResult, { kind: "captured" }>,
): Promise<AnalyzeStepResult> {
  const startedAt = Date.now();
  const { analysis, inputTokens, outputTokens } = await analyzeChange({
    competitorName: capture.meta.competitorName,
    sourceType: capture.meta.sourceType,
    sourceUrl: capture.meta.sourceUrl,
    isFirstSnapshot: capture.isFirstSnapshot,
    diff: capture.diff,
    afterText: capture.normalized,
  });
  await logAiRun({
    orgId,
    type: "change_analyze",
    model: reasoningModelId(),
    inputTokens,
    outputTokens,
    latencyMs: Date.now() - startedAt,
    input: capture.diff,
    output: analysis.summary,
    metadata: { sourceId, confidence: analysis.confidence },
  });

  if (!analysis.isMeaningful) {
    return { changeId: null, meaningful: false, confidence: analysis.confidence };
  }

  const change = await prisma.change.create({
    data: {
      orgId,
      competitorId: capture.meta.competitorId,
      sourceId,
      summary: analysis.summary,
      whyItMatters: analysis.whyItMatters,
      category: analysis.category,
      impact: analysis.impact,
      confidence: analysis.confidence,
      diffExcerpt: capture.isFirstSnapshot ? null : capture.diff,
      snapshotBeforeId: capture.previousSnapshotId,
      snapshotAfterId: capture.snapshotId,
      status: "new",
    },
    select: { id: true },
  });

  // High-impact changes draft a PENDING battlecard suggestion (human-approved,
  // never auto-applied). Non-throwing so it can't break this idempotent step or
  // duplicate the change above.
  if (analysis.impact === "high") {
    await maybeSuggestBattlecard({
      orgId,
      competitorId: capture.meta.competitorId,
      competitorName: capture.meta.competitorName,
      changeId: change.id,
      summary: analysis.summary,
      whyItMatters: analysis.whyItMatters,
      category: analysis.category,
    });
  }

  return { changeId: change.id, meaningful: true, confidence: analysis.confidence };
}

/**
 * Step 3 — embed the snapshot into intel_chunks. OPTIONAL and non-blocking:
 * skips silently when OpenAI is unconfigured; on failure (quota), logs a failed
 * `ai_run` and returns false. Idempotent: clears any existing chunks for the
 * snapshot first, so a retry can't create duplicates. Returns true only when
 * embeddings were written.
 */
export async function embedSnapshot(
  orgId: string,
  competitorId: string,
  snapshotId: string,
  text: string,
): Promise<boolean> {
  if (!embeddingsConfigured()) return false;

  const chunks = chunkText(text).slice(0, MAX_CHUNKS);
  if (chunks.length === 0) return false;

  const startedAt = Date.now();
  try {
    const { embeddings, tokens } = await embedTexts(chunks);

    // Idempotency: remove any prior chunks for this snapshot before inserting.
    await prisma.intelChunk.deleteMany({
      where: { orgId, sourceSnapshotId: snapshotId },
    });

    for (let i = 0; i < chunks.length; i++) {
      const embedding = embeddings[i];
      if (!embedding) continue;
      await prisma.$executeRawUnsafe(
        `insert into intel_chunks (org_id, competitor_id, source_snapshot_id, content, embedding)
         values ($1::uuid, $2::uuid, $3::uuid, $4, $5::vector)`,
        orgId,
        competitorId,
        snapshotId,
        chunks[i],
        toVectorLiteral(embedding),
      );
    }

    await logAiRun({
      orgId,
      type: "embed",
      model: embeddingModelId(),
      inputTokens: tokens,
      outputTokens: 0,
      latencyMs: Date.now() - startedAt,
    });
    return true;
  } catch (err) {
    const reason = isQuotaError(err) ? "openai_quota" : "embed_error";
    console.warn(`Embeddings skipped (${reason}):`, err);
    await logAiRun({
      orgId,
      type: "embed",
      model: embeddingModelId(),
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: Date.now() - startedAt,
      status: reason,
    });
    return false;
  }
}

/** Step 4 — mark the source as scanned. */
export async function markScanned(sourceId: string): Promise<void> {
  await prisma.source.update({
    where: { id: sourceId },
    data: { lastScannedAt: new Date() },
  });
}

// ─────────────────────────────────────────────────────────────
// Manual "Scan now" — synchronous orchestration over the steps above.
// (The scheduled path runs the same steps as durable Inngest steps.)
// ─────────────────────────────────────────────────────────────

export interface ScanResult {
  changed: boolean;
  meaningful: boolean;
  changeId: string | null;
  snapshotId: string | null;
  embeddingsSkipped: boolean;
  message: string;
}

export async function scanSource(
  orgId: string,
  sourceId: string,
): Promise<ScanResult> {
  const capture = await captureSnapshot(orgId, sourceId);

  if (capture.kind === "unchanged") {
    return {
      changed: false,
      meaningful: false,
      changeId: null,
      snapshotId: capture.snapshotId,
      embeddingsSkipped: false,
      message: "No change since last scan.",
    };
  }

  const analysis = await analyzeAndStoreChange(orgId, sourceId, capture);
  const embedded = await embedSnapshot(
    orgId,
    capture.meta.competitorId,
    capture.snapshotId,
    capture.normalized,
  );
  await markScanned(sourceId);

  const embeddingsSkipped = !embedded;
  const note = embeddingsSkipped ? ` ${EMBEDDINGS_UNAVAILABLE_NOTE}` : "";
  const base = capture.isFirstSnapshot
    ? "Baseline captured."
    : analysis.meaningful
      ? "Change detected and summarized."
      : "Snapshot captured; no meaningful change to report.";

  return {
    changed: true,
    meaningful: analysis.meaningful,
    changeId: analysis.changeId,
    snapshotId: capture.snapshotId,
    embeddingsSkipped,
    message: `${base}${note}`,
  };
}
