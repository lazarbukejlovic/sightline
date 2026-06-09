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
import {
  embedTexts,
  toVectorLiteral,
  embeddingsConfigured,
  isQuotaError,
} from "@/lib/ai/embeddings";
import { reasoningModelId, embeddingModelId } from "@/lib/ai/models";
import { logAiRun } from "@/lib/ai/runs";

export interface ScanResult {
  changed: boolean;
  meaningful: boolean;
  changeId: string | null;
  snapshotId: string | null;
  /** True when the snapshot was saved but no embeddings were written. */
  embeddingsSkipped: boolean;
  message: string;
}

const MAX_CHUNKS = 20;

const EMBEDDINGS_UNAVAILABLE_NOTE =
  "Embeddings skipped because OpenAI billing/quota is unavailable.";

/**
 * Manual "Scan now" for one source. All reads/writes are scoped by `orgId`
 * (app-layer tenancy). Synchronous for Phase 1; Phase 2 moves this to Inngest.
 */
export async function scanSource(
  orgId: string,
  sourceId: string,
): Promise<ScanResult> {
  const source = await prisma.source.findFirst({
    where: { id: sourceId, orgId },
    include: { competitor: { select: { id: true, name: true } } },
  });
  if (!source) {
    throw new Error("Source not found in this organization.");
  }

  // 1. Fetch + normalize + hash.
  const page = await fetchPage(source.url);
  const normalized = normalizeContent(page.text);
  const hash = contentHash(normalized);

  // 2. Compare against the most recent snapshot.
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
    return {
      changed: false,
      meaningful: false,
      changeId: null,
      snapshotId: previous.id,
      embeddingsSkipped: false,
      message: "No change since last scan.",
    };
  }

  // 3. Store the new snapshot.
  const snapshot = await prisma.sourceSnapshot.create({
    data: {
      orgId,
      sourceId,
      contentText: normalized,
      contentHash: hash,
      rawUrl: source.url,
    },
    select: { id: true },
  });

  const isFirstSnapshot = !previous;
  const diff = previous
    ? diffExcerpt(previous.contentText, normalized)
    : normalized.slice(0, 2000);

  // 4. Analyze (structured LLM output) + log the ai_run.
  const startedAt = Date.now();
  const { analysis, inputTokens, outputTokens } = await analyzeChange({
    competitorName: source.competitor.name,
    sourceType: source.type,
    sourceUrl: source.url,
    isFirstSnapshot,
    diff,
    afterText: normalized,
  });
  await logAiRun({
    orgId,
    type: "change_analyze",
    model: reasoningModelId(),
    inputTokens,
    outputTokens,
    latencyMs: Date.now() - startedAt,
  });

  // 5. Create a change card when the model judged the change meaningful.
  let changeId: string | null = null;
  if (analysis.isMeaningful) {
    const change = await prisma.change.create({
      data: {
        orgId,
        competitorId: source.competitor.id,
        sourceId,
        summary: analysis.summary,
        whyItMatters: analysis.whyItMatters,
        category: analysis.category,
        impact: analysis.impact,
        confidence: analysis.confidence,
        diffExcerpt: previous ? diff : null,
        snapshotBeforeId: previous?.id ?? null,
        snapshotAfterId: snapshot.id,
        status: "new",
      },
      select: { id: true },
    });
    changeId = change.id;
  }

  // 6. Embed the snapshot delta into intel_chunks (org-scoped).
  //    Best-effort: embeddings are OPTIONAL and must never fail the scan.
  const embedded = await embedSnapshot(
    orgId,
    source.competitor.id,
    snapshot.id,
    normalized,
  );

  // 7. Mark the source scanned.
  await prisma.source.update({
    where: { id: sourceId },
    data: { lastScannedAt: new Date() },
  });

  const embeddingsSkipped = !embedded;
  const note = embeddingsSkipped ? ` ${EMBEDDINGS_UNAVAILABLE_NOTE}` : "";

  let base: string;
  if (isFirstSnapshot) {
    base = "Baseline captured.";
  } else if (analysis.isMeaningful) {
    base = "Change detected and summarized.";
  } else {
    base = "Snapshot captured; no meaningful change to report.";
  }

  return {
    changed: true,
    meaningful: analysis.isMeaningful,
    changeId,
    snapshotId: snapshot.id,
    embeddingsSkipped,
    message: `${base}${note}`,
  };
}

/**
 * Embed a snapshot into intel_chunks. OPTIONAL and fully non-blocking:
 *  - if OpenAI isn't configured, skip silently and return false;
 *  - if the embedding call fails (e.g. quota/billing), catch it, log a failed
 *    `ai_run` for observability, and return false.
 * The snapshot is already saved by the caller, so the scan stands on its own.
 * Returns true only when embeddings were actually written.
 */
async function embedSnapshot(
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

    // Parameterized inserts; embedding cast to pgvector. id/created_at use DB
    // defaults from the schema.
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
    // Non-fatal. Record the failed run, then carry on.
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
