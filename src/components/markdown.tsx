import * as React from "react";
import { parseMarkdown, parseInline, type Inline } from "@/lib/markdown";
import { cn } from "@/lib/utils";

function renderInline(text: string, keyBase: string): React.ReactNode[] {
  return parseInline(text).map((node: Inline, i) => {
    const key = `${keyBase}-${i}`;
    switch (node.type) {
      case "bold":
        return (
          <strong key={key} className="font-semibold text-foreground">
            {node.value}
          </strong>
        );
      case "italic":
        return (
          <em key={key} className="italic">
            {node.value}
          </em>
        );
      case "code":
        return (
          <code
            key={key}
            className="rounded bg-secondary px-1 py-0.5 font-mono text-[0.85em]"
          >
            {node.value}
          </code>
        );
      case "link":
        return (
          <a
            key={key}
            href={node.href}
            target="_blank"
            rel="noreferrer"
            className="text-foreground underline underline-offset-2 hover:text-signal"
          >
            {node.value}
          </a>
        );
      default:
        return <React.Fragment key={key}>{node.value}</React.Fragment>;
    }
  });
}

const headingClass: Record<number, string> = {
  1: "font-display text-2xl tracking-tight mt-2",
  2: "font-display text-xl tracking-tight mt-2",
  3: "font-display text-lg",
  4: "text-sm font-semibold uppercase tracking-wide text-muted-foreground",
  5: "text-sm font-semibold",
  6: "text-sm font-semibold",
};

/**
 * Renders a Markdown string as styled, on-brand content (headings, bold/italic,
 * lists, real tables). Safe: builds elements from a parsed AST, no raw HTML.
 */
export function Markdown({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const blocks = parseMarkdown(content);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 text-sm leading-relaxed [overflow-wrap:anywhere]",
        className,
      )}
    >
      {blocks.map((block, i) => {
        const key = `b-${i}`;
        switch (block.type) {
          case "heading": {
            const Tag = `h${Math.min(block.level + 1, 6)}` as React.ElementType;
            return (
              <Tag key={key} className={headingClass[block.level] ?? headingClass[6]}>
                {renderInline(block.text, key)}
              </Tag>
            );
          }
          case "paragraph":
            return (
              <p key={key} className="text-foreground/90">
                {renderInline(block.text, key)}
              </p>
            );
          case "list":
            return block.ordered ? (
              <ol key={key} className="ml-5 flex list-decimal flex-col gap-1 marker:text-muted-foreground">
                {block.items.map((it, j) => (
                  <li key={j} className="pl-1">
                    {renderInline(it, `${key}-${j}`)}
                  </li>
                ))}
              </ol>
            ) : (
              <ul key={key} className="ml-5 flex list-disc flex-col gap-1 marker:text-signal/60">
                {block.items.map((it, j) => (
                  <li key={j} className="pl-1">
                    {renderInline(it, `${key}-${j}`)}
                  </li>
                ))}
              </ul>
            );
          case "table":
            return (
              <div
                key={key}
                className="overflow-x-auto rounded-lg border border-border shadow-sm"
              >
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b-2 border-ink/15 bg-secondary/60">
                      {block.headers.map((h, j) => (
                        <th
                          key={j}
                          className="px-3.5 py-2.5 font-meta text-[10px] uppercase tracking-[0.12em] text-muted-foreground"
                        >
                          {renderInline(h, `${key}-h-${j}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, r) => (
                      <tr
                        key={r}
                        className="border-b border-border/60 last:border-0 odd:bg-secondary/20"
                      >
                        {row.map((cell, c) => (
                          <td
                            key={c}
                            className="px-3.5 py-2 align-top tabular-nums"
                          >
                            {renderInline(cell, `${key}-${r}-${c}`)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
