"use client";

import { useState, useTransition } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { submitFeedback } from "@/app/app/actions";

type Rating = "up" | "down";

/**
 * Thumbs up/down (+ optional correction) on an AI answer or change summary.
 * Writes to ai_feedback via the submitFeedback server action; one vote per
 * user/target. Optimistic, restrained.
 */
export function FeedbackButtons({
  changeId,
  aiRunId,
  initialRating = null,
}: {
  changeId?: string;
  aiRunId?: string;
  initialRating?: Rating | null;
}) {
  const [rating, setRating] = useState<Rating | null>(initialRating);
  const [showCorrection, setShowCorrection] = useState(false);
  const [correction, setCorrection] = useState("");
  const [isPending, startTransition] = useTransition();

  function send(next: Rating, withCorrection: boolean) {
    setRating(next);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("rating", next);
      if (changeId) fd.set("changeId", changeId);
      if (aiRunId) fd.set("aiRunId", aiRunId);
      if (withCorrection && correction.trim()) {
        fd.set("correctedOutput", correction.trim());
      }
      await submitFeedback({}, fd);
    });
  }

  function vote(next: Rating) {
    if (next === "down") setShowCorrection(true);
    else setShowCorrection(false);
    send(next, next === "down");
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="rule-eyebrow text-[9px] text-muted-foreground">
          Useful?
        </span>
        <button
          type="button"
          aria-label="Helpful"
          aria-pressed={rating === "up"}
          disabled={isPending}
          onClick={() => vote("up")}
          className={cn(
            "flex size-7 items-center justify-center rounded-md border transition-colors",
            rating === "up"
              ? "border-teal/40 bg-teal/10 text-teal"
              : "border-border text-muted-foreground hover:border-ink/30 hover:text-foreground",
          )}
        >
          <ThumbsUp className="size-3.5" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          aria-label="Not helpful"
          aria-pressed={rating === "down"}
          disabled={isPending}
          onClick={() => vote("down")}
          className={cn(
            "flex size-7 items-center justify-center rounded-md border transition-colors",
            rating === "down"
              ? "border-signal/40 bg-signal/10 text-signal"
              : "border-border text-muted-foreground hover:border-ink/30 hover:text-foreground",
          )}
        >
          <ThumbsDown className="size-3.5" strokeWidth={1.75} />
        </button>
        {rating && !showCorrection && (
          <span className="font-meta text-[10px] text-muted-foreground">
            recorded
          </span>
        )}
      </div>

      {showCorrection && (
        <div className="flex flex-col gap-1.5">
          <Textarea
            value={correction}
            onChange={(e) => setCorrection(e.target.value)}
            rows={2}
            placeholder="Optional: what should it have said? (saved as a correction)"
            className="text-xs"
          />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => {
                send("down", true);
                setShowCorrection(false);
              }}
            >
              Save correction
            </Button>
            <button
              type="button"
              onClick={() => setShowCorrection(false)}
              className="font-meta text-[10px] text-muted-foreground hover:text-foreground"
            >
              skip
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
