/**
 * A tiny, dependency-free Markdown parser for AI-generated content (digests,
 * suggestions). Covers the block + inline subset those produce: headings,
 * bold/italic/code/links, ordered & unordered lists, and GFM pipe tables.
 *
 * Parsing is pure (no React) so it can be unit-tested; rendering lives in
 * src/components/markdown.tsx. We never use dangerouslySetInnerHTML — the
 * renderer builds elements from this AST, so content can't inject markup.
 */

export type Inline =
  | { type: "text"; value: string }
  | { type: "bold"; value: string }
  | { type: "italic"; value: string }
  | { type: "code"; value: string }
  | { type: "link"; value: string; href: string };

export type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] };

const INLINE_RE =
  /(`[^`]+`)|(\[[^\]]+\]\([^)]+\))|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(_[^_]+_)/g;

/** Tokenize a line of inline Markdown into styled spans. */
export function parseInline(input: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  INLINE_RE.lastIndex = 0;

  while ((m = INLINE_RE.exec(input)) !== null) {
    if (m.index > last) {
      out.push({ type: "text", value: input.slice(last, m.index) });
    }
    const tok = m[0];
    if (tok.startsWith("`")) {
      out.push({ type: "code", value: tok.slice(1, -1) });
    } else if (tok.startsWith("[")) {
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok)!;
      out.push({ type: "link", value: link[1]!, href: link[2]! });
    } else if (tok.startsWith("**")) {
      out.push({ type: "bold", value: tok.slice(2, -2) });
    } else {
      out.push({ type: "italic", value: tok.slice(1, -1) });
    }
    last = m.index + tok.length;
  }
  if (last < input.length) {
    out.push({ type: "text", value: input.slice(last) });
  }
  return out;
}

function parseRow(line: string): string[] {
  let t = line.trim();
  if (t.startsWith("|")) t = t.slice(1);
  if (t.endsWith("|")) t = t.slice(0, -1);
  return t.split("|").map((c) => c.trim());
}

function isTableRow(line: string): boolean {
  return line.includes("|");
}

function isTableSeparator(line: string): boolean {
  const cells = parseRow(line);
  return cells.length > 0 && cells.every((c) => /^:?-+:?$/.test(c));
}

function isSpecial(line: string): boolean {
  return (
    /^#{1,6}\s+/.test(line) ||
    /^\s*[-*+]\s+/.test(line) ||
    /^\s*\d+\.\s+/.test(line) ||
    isTableRow(line)
  );
}

/** Parse a Markdown string into a flat list of block nodes. */
export function parseMarkdown(md: string): Block[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;
    if (line.trim() === "") {
      i++;
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push({
        type: "heading",
        level: heading[1]!.length,
        text: heading[2]!.trim(),
      });
      i++;
      continue;
    }

    // GFM table: a row followed by a separator row.
    if (
      isTableRow(line) &&
      i + 1 < lines.length &&
      isTableSeparator(lines[i + 1]!)
    ) {
      const headers = parseRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && isTableRow(lines[i]!) && lines[i]!.trim() !== "") {
        rows.push(parseRow(lines[i]!));
        i++;
      }
      blocks.push({ type: "table", headers, rows });
      continue;
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i]!)) {
        items.push(lines[i]!.replace(/^\s*[-*+]\s+/, ""));
        i++;
      }
      blocks.push({ type: "list", ordered: false, items });
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i]!)) {
        items.push(lines[i]!.replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      blocks.push({ type: "list", ordered: true, items });
      continue;
    }

    // Paragraph: gather consecutive plain lines.
    const para = [line];
    i++;
    while (i < lines.length && lines[i]!.trim() !== "" && !isSpecial(lines[i]!)) {
      para.push(lines[i]!);
      i++;
    }
    blocks.push({ type: "paragraph", text: para.join(" ") });
  }

  return blocks;
}
