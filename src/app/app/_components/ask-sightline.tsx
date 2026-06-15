"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Callout } from "@/components/ui/callout";
import { FeedbackButtons } from "@/app/app/_components/feedback-buttons";
import { DURATION, EASE_OUT, staggerContainer, staggerItem } from "@/lib/motion";

interface Citation {
  index: number;
  competitorName: string;
  sourceUrl: string;
  sourceType: string;
}

interface CostInfo {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  model: string;
}

export function AskSightline({ competitorId }: { competitorId?: string }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [citations, setCitations] = useState<Citation[]>([]);
  const [cost, setCost] = useState<CostInfo | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "streaming" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function ask() {
    const q = question.trim();
    if (q.length < 3 || status === "streaming") return;

    setStatus("streaming");
    setAnswer("");
    setCitations([]);
    setCost(null);
    setRunId(null);
    setError(null);
    setNotice(null);
    setRateLimited(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, competitorId }),
        signal: controller.signal,
      });

      // A JSON response is a non-streaming notice (e.g. embeddings disabled /
      // no intel yet) or a validation error — handle it cleanly.
      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const body = await res.json().catch(() => null);
        if (body?.unavailable) {
          setNotice(body.message as string);
          setStatus("idle");
          return;
        }
        // Rate limited: a known, expected backpressure signal — surface it as a
        // calm "cooling down" affordance, not a hard error.
        if (res.status === 429) {
          setRateLimited(typeof body?.retryAfter === "number" ? body.retryAfter : 0);
          setStatus("idle");
          return;
        }
        throw new Error(body?.error ?? `Request failed (${res.status}).`);
      }

      if (!res.ok || !res.body) {
        throw new Error(`Request failed (${res.status}).`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as
            | { type: "sources"; citations: Citation[] }
            | { type: "text"; text: string }
            | { type: "done"; cost: CostInfo; runId: string | null }
            | { type: "error"; error: string };

          if (event.type === "sources") setCitations(event.citations);
          else if (event.type === "text")
            setAnswer((prev) => prev + event.text);
          else if (event.type === "done") {
            setCost(event.cost);
            setRunId(event.runId);
          } else if (event.type === "error") throw new Error(event.error);
        }
      }
      setStatus("idle");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div>
        <h3 className="font-display text-lg">Ask Sightline</h3>
        <p className="font-meta text-xs text-muted-foreground">
          RAG over your collected intel · cited · cost shown
        </p>
      </div>

      <Textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="How did Northwind change pricing recently?"
        rows={3}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) ask();
        }}
      />
      <div className="flex items-center justify-between">
        <span className="font-meta text-xs text-muted-foreground">
          ⌘/Ctrl + Enter
        </span>
        <Button
          size="sm"
          onClick={ask}
          disabled={status === "streaming" || question.trim().length < 3}
        >
          {status === "streaming" ? "Thinking…" : "Ask"}
        </Button>
      </div>

      {error && <Callout tone="error">{error}</Callout>}

      {notice && <Callout tone="info">{notice}</Callout>}

      {rateLimited !== null && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION.base, ease: EASE_OUT }}
          className="flex items-center gap-2.5 rounded-md border border-amber/30 bg-amber/10 px-3 py-2.5"
        >
          <span aria-hidden className="size-2 shrink-0 rounded-full bg-amber animate-breathe" />
          <span className="rule-eyebrow text-[9px] text-amber">Rate limited</span>
          <span className="text-xs text-foreground">
            Catching our breath
            {rateLimited > 0 ? (
              <>
                {" "}
                — try again in{" "}
                <span className="font-meta tabular-nums">{rateLimited}s</span>
              </>
            ) : (
              " — try again shortly"
            )}
            .
          </span>
        </motion.div>
      )}

      {(answer || status === "streaming") && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION.base, ease: EASE_OUT }}
          className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-md bg-secondary/40 p-3 text-sm leading-relaxed [overflow-wrap:anywhere]"
        >
          {answer ? (
            <>
              {answer}
              {status === "streaming" && (
                <motion.span
                  aria-hidden
                  className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 bg-signal"
                  animate={{ opacity: [1, 0.2, 1] }}
                  transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
                />
              )}
            </>
          ) : (
            <span className="text-muted-foreground">Retrieving intel…</span>
          )}
        </motion.div>
      )}

      {citations.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="font-meta text-xs uppercase tracking-wide text-muted-foreground">
            Sources
          </span>
          <motion.ol
            className="flex flex-col gap-1"
            variants={staggerContainer(0.05)}
            initial="hidden"
            animate="show"
          >
            {citations.map((c) => (
              <motion.li
                key={c.index}
                variants={staggerItem}
                className="font-meta text-xs [overflow-wrap:anywhere]"
              >
                <span className="text-signal">[{c.index}]</span>{" "}
                <span className="text-foreground">{c.competitorName}</span>{" "}
                <span className="text-muted-foreground">· {c.sourceType} · </span>
                <a
                  href={c.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                  {c.sourceUrl}
                </a>
              </motion.li>
            ))}
          </motion.ol>
        </div>
      )}

      {cost && (
        <p className="font-meta text-xs tabular-nums text-muted-foreground [overflow-wrap:anywhere]">
          {cost.inputTokens.toLocaleString()} in ·{" "}
          {cost.outputTokens.toLocaleString()} out ·{" "}
          <span className="text-foreground">${cost.costUsd.toFixed(4)}</span> ·{" "}
          {cost.model}
        </p>
      )}

      {runId && status === "idle" && (
        <div className="border-t border-border pt-3">
          <FeedbackButtons aiRunId={runId} />
        </div>
      )}
    </div>
  );
}
