import "server-only";
import { prisma } from "@/lib/db/prisma";
import { toVectorLiteral } from "@/lib/ai/embeddings";

export interface RetrievedChunk {
  id: string;
  content: string;
  competitorId: string;
  competitorName: string;
  snapshotId: string;
  sourceUrl: string;
  sourceType: string;
  similarity: number;
}

interface ChunkRow {
  id: string;
  content: string;
  competitor_id: string;
  competitor_name: string;
  snapshot_id: string;
  source_url: string;
  source_type: string;
  similarity: number;
}

/**
 * Retrieve the top-k most similar intel chunks for a query embedding, scoped to
 * the org. The `org_id = $2` filter is the app-layer tenancy guard — a query is
 * never issued without it (RLS is the second layer at the DB).
 */
export async function retrieveChunks(
  orgId: string,
  queryEmbedding: number[],
  k = 6,
  competitorId?: string,
): Promise<RetrievedChunk[]> {
  if (queryEmbedding.length === 0) return [];
  const vec = toVectorLiteral(queryEmbedding);

  const rows = await prisma.$queryRawUnsafe<ChunkRow[]>(
    `select ic.id,
            ic.content,
            ic.competitor_id,
            c.name as competitor_name,
            ss.id as snapshot_id,
            s.url as source_url,
            s.type::text as source_type,
            1 - (ic.embedding <=> $1::vector) as similarity
     from intel_chunks ic
     join competitors c on c.id = ic.competitor_id
     join source_snapshots ss on ss.id = ic.source_snapshot_id
     join sources s on s.id = ss.source_id
     where ic.org_id = $2::uuid
       and ic.embedding is not null
       and ($4::uuid is null or ic.competitor_id = $4::uuid)
     order by ic.embedding <=> $1::vector
     limit $3`,
    vec,
    orgId,
    k,
    competitorId ?? null,
  );

  return rows.map((r) => ({
    id: r.id,
    content: r.content,
    competitorId: r.competitor_id,
    competitorName: r.competitor_name,
    snapshotId: r.snapshot_id,
    sourceUrl: r.source_url,
    sourceType: r.source_type,
    similarity: Number(r.similarity),
  }));
}

export interface Citation {
  index: number;
  competitorName: string;
  sourceUrl: string;
  sourceType: string;
}

/** Build the numbered-context prompt and the citation list for the UI. */
export function buildAskPrompt(
  question: string,
  chunks: RetrievedChunk[],
): { system: string; prompt: string; citations: Citation[] } {
  const citations: Citation[] = chunks.map((c, i) => ({
    index: i + 1,
    competitorName: c.competitorName,
    sourceUrl: c.sourceUrl,
    sourceType: c.sourceType,
  }));

  const context = chunks
    .map(
      (c, i) =>
        `[${i + 1}] ${c.competitorName} — ${c.sourceType} (${c.sourceUrl})\n${c.content}`,
    )
    .join("\n\n---\n\n");

  const system =
    "You are Sightline, a competitive-intelligence assistant. Answer the user's question " +
    "using ONLY the numbered sources provided. Cite every claim inline with [n] matching the " +
    "source number. If the sources do not contain the answer, say so plainly — never invent facts. " +
    "Be concise and direct.";

  const prompt =
    chunks.length === 0
      ? `The intel library has no relevant material for this question yet.\n\nQuestion: ${question}\n\nTell the user you have no collected intel on this topic and suggest they add a competitor and run a scan.`
      : `Sources:\n\n${context}\n\n---\n\nQuestion: ${question}\n\nAnswer using the sources above, citing with [n].`;

  return { system, prompt, citations };
}
