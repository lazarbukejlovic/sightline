import { createHash } from "node:crypto";

/**
 * Normalize fetched page text so that cosmetic differences (whitespace, blank
 * lines, trailing spaces) don't register as "changes". Diffing and hashing both
 * run on the normalized form.
 */
export function normalizeContent(input: string): string {
  return input
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Stable content hash used to detect whether a source changed since last scan. */
export function contentHash(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/**
 * Split normalized text into overlapping chunks for embedding. Paragraph-aware:
 * accumulates paragraphs up to `maxChars`, never splitting mid-paragraph unless
 * a single paragraph exceeds the budget.
 */
export function chunkText(input: string, maxChars = 1200): string[] {
  const paragraphs = input
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    if (para.length > maxChars) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      for (let i = 0; i < para.length; i += maxChars) {
        chunks.push(para.slice(i, i + maxChars));
      }
      continue;
    }
    if (current.length + para.length + 2 > maxChars) {
      chunks.push(current);
      current = para;
    } else {
      current = current ? `${current}\n\n${para}` : para;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/**
 * A compact unified-ish diff excerpt: the first lines that differ between two
 * texts, prefixed with - / +. Used as evidence on a change card (not a full
 * diff engine — Phase 2 introduces redline diffing).
 */
export function diffExcerpt(before: string, after: string, maxLines = 12): string {
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");
  const beforeSet = new Set(beforeLines);
  const afterSet = new Set(afterLines);

  const removed = beforeLines.filter((l) => l.trim() && !afterSet.has(l));
  const added = afterLines.filter((l) => l.trim() && !beforeSet.has(l));

  const lines = [
    ...removed.slice(0, maxLines).map((l) => `- ${l}`),
    ...added.slice(0, maxLines).map((l) => `+ ${l}`),
  ];
  return lines.join("\n").slice(0, 4000);
}
