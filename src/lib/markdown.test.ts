import { describe, it, expect } from "vitest";
import { parseInline, parseMarkdown } from "@/lib/markdown";

describe("parseInline", () => {
  it("splits bold, italic, code, and links", () => {
    expect(parseInline("a **b** c")).toEqual([
      { type: "text", value: "a " },
      { type: "bold", value: "b" },
      { type: "text", value: " c" },
    ]);
    expect(parseInline("`x`")).toEqual([{ type: "code", value: "x" }]);
    expect(parseInline("[t](https://e.com)")).toEqual([
      { type: "link", value: "t", href: "https://e.com" },
    ]);
  });

  it("treats plain text as a single node", () => {
    expect(parseInline("just text")).toEqual([
      { type: "text", value: "just text" },
    ]);
  });
});

describe("parseMarkdown", () => {
  it("parses headings at the right level", () => {
    expect(parseMarkdown("## Pricing")).toEqual([
      { type: "heading", level: 2, text: "Pricing" },
    ]);
  });

  it("parses an unordered list", () => {
    const blocks = parseMarkdown("- one\n- two");
    expect(blocks).toEqual([
      { type: "list", ordered: false, items: ["one", "two"] },
    ]);
  });

  it("parses a GFM pipe table with header + rows", () => {
    const md = `| Competitor | Impact |\n| --- | --- |\n| Acme | High |\n| Globex | Low |`;
    expect(parseMarkdown(md)).toEqual([
      {
        type: "table",
        headers: ["Competitor", "Impact"],
        rows: [
          ["Acme", "High"],
          ["Globex", "Low"],
        ],
      },
    ]);
  });

  it("does not mistake a piped paragraph for a table (no separator row)", () => {
    const blocks = parseMarkdown("a | b but not a table");
    expect(blocks[0]!.type).toBe("paragraph");
  });

  it("collects multi-line paragraphs and separates on blank lines", () => {
    const blocks = parseMarkdown("line one\nline two\n\nsecond para");
    expect(blocks).toEqual([
      { type: "paragraph", text: "line one line two" },
      { type: "paragraph", text: "second para" },
    ]);
  });
});
