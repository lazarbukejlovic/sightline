import { describe, it, expect } from "vitest";
import {
  normalizeContent,
  contentHash,
  chunkText,
  diffExcerpt,
} from "@/lib/text/normalize";

describe("normalizeContent", () => {
  it("collapses whitespace and trims", () => {
    expect(normalizeContent("  Hello   world  \n\n\n\nfoo  ")).toBe(
      "Hello world\n\nfoo",
    );
  });

  it("treats cosmetic whitespace differences as equal", () => {
    // Trailing spaces, tabs, CRLF, and 3+ blank lines are all cosmetic.
    const a = normalizeContent("Plan:  $49  \r\n\r\n\r\n\r\nPro tier  ");
    const b = normalizeContent("Plan: $49\n\nPro tier");
    expect(a).toBe(b);
  });
});

describe("contentHash", () => {
  it("is stable for identical input", () => {
    expect(contentHash("same text")).toBe(contentHash("same text"));
  });

  it("differs when content differs", () => {
    expect(contentHash("a")).not.toBe(contentHash("b"));
  });

  it("produces a 64-char hex sha256", () => {
    expect(contentHash("x")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("chunkText", () => {
  it("returns one chunk for short text", () => {
    expect(chunkText("short paragraph")).toEqual(["short paragraph"]);
  });

  it("splits long text into bounded chunks", () => {
    const para = "word ".repeat(400).trim(); // ~2000 chars
    const chunks = chunkText(para, 500);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(500);
  });

  it("keeps distinct paragraphs grouped under the budget", () => {
    const chunks = chunkText("para one\n\npara two", 1200);
    expect(chunks).toEqual(["para one\n\npara two"]);
  });
});

describe("diffExcerpt", () => {
  it("marks removed and added lines", () => {
    const out = diffExcerpt("old line\nshared", "shared\nnew line");
    expect(out).toContain("- old line");
    expect(out).toContain("+ new line");
    expect(out).not.toContain("shared\nshared");
  });

  it("is empty when there is no difference", () => {
    expect(diffExcerpt("a\nb", "a\nb")).toBe("");
  });
});
