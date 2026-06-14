"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireOrgContext } from "@/lib/org/context";
import { assertAtLeast } from "@/lib/org-scope";
import { scanSource as runScan } from "@/lib/scan";
import { ensureBattlecard } from "@/lib/battlecard";
import { getOrgPlan } from "@/lib/billing/subscription";
import { canAddCompetitor, planAllows, competitorLimit } from "@/lib/billing/plans";
import { seedDemoData } from "@/lib/demo-seed";

export interface ActionState {
  error?: string;
  message?: string;
}

const competitorSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  domain: z
    .string()
    .trim()
    .max(255)
    .optional()
    .transform((v) => (v ? v.replace(/^https?:\/\//, "").replace(/\/+$/, "") : undefined)),
});

export async function createCompetitor(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { orgId, role } = await requireOrgContext();
  try {
    assertAtLeast(role, "member");
  } catch {
    return { error: "You don't have permission to add competitors." };
  }

  const parsed = competitorSchema.safeParse({
    name: formData.get("name"),
    domain: formData.get("domain") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  // Plan gate: Free orgs may track a limited number of competitors.
  const [plan, count] = await Promise.all([
    getOrgPlan(orgId),
    prisma.competitor.count({ where: { orgId } }),
  ]);
  if (!canAddCompetitor(plan, count)) {
    const limit = competitorLimit(plan);
    return {
      error: `Your plan tracks up to ${limit} competitor${limit === 1 ? "" : "s"}. Upgrade in Billing to add more.`,
    };
  }

  await prisma.competitor.create({
    data: {
      orgId,
      name: parsed.data.name,
      domain: parsed.data.domain ?? null,
    },
  });

  revalidatePath("/app");
  return { message: `Now tracking ${parsed.data.name}.` };
}

const sourceSchema = z.object({
  competitorId: z.string().uuid("Invalid competitor."),
  type: z.enum(["pricing", "changelog", "blog", "news", "careers", "custom"]),
  url: z.string().url("Enter a valid URL (including https://)."),
});

export async function createSource(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { orgId, role } = await requireOrgContext();
  try {
    assertAtLeast(role, "member");
  } catch {
    return { error: "You don't have permission to add sources." };
  }

  const parsed = sourceSchema.safeParse({
    competitorId: formData.get("competitorId"),
    type: formData.get("type"),
    url: formData.get("url"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  // Verify the competitor belongs to this org before attaching a source.
  const competitor = await prisma.competitor.findFirst({
    where: { id: parsed.data.competitorId, orgId },
    select: { id: true },
  });
  if (!competitor) {
    return { error: "Competitor not found in this organization." };
  }

  await prisma.source.create({
    data: {
      orgId,
      competitorId: competitor.id,
      type: parsed.data.type,
      url: parsed.data.url,
    },
  });

  revalidatePath(`/app/competitors/${competitor.id}`);
  revalidatePath("/app");
  return { message: "Source added. Run a scan to capture the first snapshot." };
}

export async function scanSource(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { orgId, role } = await requireOrgContext();
  try {
    assertAtLeast(role, "member");
  } catch {
    return { error: "You don't have permission to run scans." };
  }

  const sourceId = z.string().uuid().safeParse(formData.get("sourceId"));
  if (!sourceId.success) {
    return { error: "Invalid source." };
  }

  try {
    const result = await runScan(orgId, sourceId.data);
    revalidatePath("/app");
    const source = await prisma.source.findFirst({
      where: { id: sourceId.data, orgId },
      select: { competitorId: true },
    });
    if (source) revalidatePath(`/app/competitors/${source.competitorId}`);
    return { message: result.message };
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error.";
    return { error: `Scan failed: ${detail}` };
  }
}

const reviewSchema = z.object({
  changeId: z.string().uuid(),
  decision: z.enum(["reviewed", "dismissed"]),
});

/**
 * Resolve a Review Queue item: mark a low-confidence change as reviewed
 * (keep it) or dismissed (hide it). Org-scoped and role-gated.
 */
export async function reviewChange(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { orgId, role } = await requireOrgContext();
  try {
    assertAtLeast(role, "member");
  } catch {
    return { error: "You don't have permission to review changes." };
  }

  const parsed = reviewSchema.safeParse({
    changeId: formData.get("changeId"),
    decision: formData.get("decision"),
  });
  if (!parsed.success) {
    return { error: "Invalid review action." };
  }

  // Scope by org_id so a client can never resolve another org's change.
  const result = await prisma.change.updateMany({
    where: { id: parsed.data.changeId, orgId },
    data: { status: parsed.data.decision },
  });
  if (result.count === 0) {
    return { error: "Change not found in this organization." };
  }

  revalidatePath("/app/review");
  revalidatePath("/app");
  return {
    message:
      parsed.data.decision === "reviewed"
        ? "Marked reviewed — moved to the Intel Feed."
        : "Dismissed.",
  };
}

// ─────────────────────────────────────────────────────────────
// Phase 3 — collaboration
// ─────────────────────────────────────────────────────────────

/**
 * Open (creating on first use) a competitor's battlecard, then redirect to it.
 * Creating requires member+; viewers may open an existing one.
 */
export async function openBattlecard(formData: FormData): Promise<void> {
  const { orgId, role } = await requireOrgContext();
  const competitorId = z.string().uuid().safeParse(formData.get("competitorId"));
  if (!competitorId.success) redirect("/app");

  const competitor = await prisma.competitor.findFirst({
    where: { id: competitorId.data, orgId },
    select: { id: true, name: true },
  });
  if (!competitor) redirect("/app");

  // Plan gate: collaborative battlecards are a paid feature.
  const plan = await getOrgPlan(orgId);
  if (!planAllows(plan, "battlecards")) {
    redirect(
      `/app/billing?upgrade=battlecards` as Route,
    );
  }

  const existing = await prisma.battlecard.findUnique({
    where: { orgId_competitorId: { orgId, competitorId: competitor.id } },
    select: { id: true },
  });

  let battlecardId: string;
  if (existing) {
    battlecardId = existing.id;
  } else {
    // Only editors may create the battlecard.
    assertAtLeast(role, "member");
    const created = await ensureBattlecard(
      orgId,
      competitor.id,
      `${competitor.name} battlecard`,
    );
    battlecardId = created.id;
  }

  redirect(`/app/battlecards/${battlecardId}` as Route);
}

const commentSchema = z.object({
  targetType: z.enum(["change", "battlecard"]),
  targetId: z.string().uuid(),
  body: z.string().trim().min(1, "Write a comment.").max(2000),
});

export async function addComment(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { user, orgId, role } = await requireOrgContext();
  try {
    assertAtLeast(role, "member");
  } catch {
    return { error: "Viewers can read but not comment." };
  }

  const parsed = commentSchema.safeParse({
    targetType: formData.get("targetType"),
    targetId: formData.get("targetId"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid comment." };
  }

  // Verify the target belongs to this org before attaching a comment.
  const target =
    parsed.data.targetType === "change"
      ? await prisma.change.findFirst({
          where: { id: parsed.data.targetId, orgId },
          select: { id: true },
        })
      : await prisma.battlecard.findFirst({
          where: { id: parsed.data.targetId, orgId },
          select: { id: true },
        });
  if (!target) return { error: "Target not found in this organization." };

  await prisma.comment.create({
    data: {
      orgId,
      targetType: parsed.data.targetType,
      targetId: parsed.data.targetId,
      authorId: user.id,
      body: parsed.data.body,
    },
  });

  if (parsed.data.targetType === "change") revalidatePath("/app/review");
  else revalidatePath(`/app/battlecards/${parsed.data.targetId}`);
  return { message: "Comment added." };
}

const assignSchema = z.object({
  changeId: z.string().uuid(),
  assigneeId: z.string().uuid(),
});

export async function assignChange(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { user, orgId, role } = await requireOrgContext();
  try {
    assertAtLeast(role, "member");
  } catch {
    return { error: "Viewers can't assign changes." };
  }

  const parsed = assignSchema.safeParse({
    changeId: formData.get("changeId"),
    assigneeId: formData.get("assigneeId"),
  });
  if (!parsed.success) return { error: "Invalid assignment." };

  const [change, assignee] = await Promise.all([
    prisma.change.findFirst({
      where: { id: parsed.data.changeId, orgId },
      select: { id: true },
    }),
    prisma.membership.findFirst({
      where: { orgId, userId: parsed.data.assigneeId },
      select: { userId: true },
    }),
  ]);
  if (!change) return { error: "Change not found in this organization." };
  if (!assignee) return { error: "Assignee is not a member of this org." };

  await prisma.assignment.upsert({
    where: { changeId: parsed.data.changeId },
    create: {
      orgId,
      changeId: parsed.data.changeId,
      assigneeId: parsed.data.assigneeId,
      assignedById: user.id,
      status: "open",
    },
    update: {
      assigneeId: parsed.data.assigneeId,
      assignedById: user.id,
      status: "open",
    },
  });

  revalidatePath("/app/review");
  return { message: "Assigned." };
}

const resolveSuggestionSchema = z.object({
  suggestionId: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
  battlecardId: z.string().uuid(),
});

/**
 * Resolve a pending battlecard suggestion. The DB row is marked approved or
 * rejected here; on approval the client inserts the text into the editor (a
 * human action) — suggestions are NEVER auto-applied server-side.
 */
export async function resolveSuggestion(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { user, orgId, role } = await requireOrgContext();
  try {
    assertAtLeast(role, "member");
  } catch {
    return { error: "Viewers can't resolve suggestions." };
  }

  const parsed = resolveSuggestionSchema.safeParse({
    suggestionId: formData.get("suggestionId"),
    decision: formData.get("decision"),
    battlecardId: formData.get("battlecardId"),
  });
  if (!parsed.success) return { error: "Invalid action." };

  const result = await prisma.battlecardSuggestion.updateMany({
    where: { id: parsed.data.suggestionId, orgId, status: "pending" },
    data: {
      status: parsed.data.decision,
      resolvedById: user.id,
      resolvedAt: new Date(),
    },
  });
  if (result.count === 0) {
    return { error: "Suggestion not found or already resolved." };
  }

  revalidatePath(`/app/battlecards/${parsed.data.battlecardId}`);
  return {
    message:
      parsed.data.decision === "approved" ? "Approved." : "Rejected.",
  };
}

// ─────────────────────────────────────────────────────────────
// Phase 4 — eval / feedback loop
// ─────────────────────────────────────────────────────────────

const feedbackSchema = z.object({
  rating: z.enum(["up", "down"]),
  correctedOutput: z.string().trim().max(4000).optional(),
  aiRunId: z.string().uuid().optional(),
  changeId: z.string().uuid().optional(),
});

/**
 * Record human feedback on AI output — a thumbs up/down (and optional
 * correction) on an Ask answer (aiRunId) or a change summary (changeId).
 * One vote per user per target; voting again updates it.
 */
export async function submitFeedback(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { user, orgId, role } = await requireOrgContext();
  try {
    assertAtLeast(role, "member");
  } catch {
    return { error: "Viewers can't submit feedback." };
  }

  const parsed = feedbackSchema.safeParse({
    rating: formData.get("rating"),
    correctedOutput: formData.get("correctedOutput") ?? undefined,
    aiRunId: formData.get("aiRunId") ?? undefined,
    changeId: formData.get("changeId") ?? undefined,
  });
  if (!parsed.success) return { error: "Invalid feedback." };

  const { rating, correctedOutput, aiRunId, changeId } = parsed.data;
  if (!aiRunId && !changeId) return { error: "Nothing to rate." };
  const corrected = correctedOutput && correctedOutput.length > 0 ? correctedOutput : null;

  // Verify the target belongs to this org before recording feedback.
  if (changeId) {
    const c = await prisma.change.findFirst({
      where: { id: changeId, orgId },
      select: { id: true },
    });
    if (!c) return { error: "Change not found in this organization." };
    await prisma.aiFeedback.upsert({
      where: { changeId_userId: { changeId, userId: user.id } },
      create: { orgId, userId: user.id, rating, correctedOutput: corrected, changeId },
      update: { rating, correctedOutput: corrected },
    });
  } else if (aiRunId) {
    const r = await prisma.aiRun.findFirst({
      where: { id: aiRunId, orgId },
      select: { id: true },
    });
    if (!r) return { error: "AI run not found in this organization." };
    await prisma.aiFeedback.upsert({
      where: { aiRunId_userId: { aiRunId, userId: user.id } },
      create: { orgId, userId: user.id, rating, correctedOutput: corrected, aiRunId },
      update: { rating, correctedOutput: corrected },
    });
  }

  revalidatePath("/app");
  revalidatePath("/app/review");
  return { message: "Thanks — feedback recorded." };
}

// ─────────────────────────────────────────────────────────────
// Phase 4 — onboarding (load sample intel)
// ─────────────────────────────────────────────────────────────

/**
 * First-run convenience: populate an empty workspace with the demo dataset
 * (real public companies + realistic detected changes, incl. a low-confidence
 * item that lands in the Review Queue) so a new user sees value immediately.
 * Only runs when the org has no competitors yet.
 */
export async function loadSampleIntel(): Promise<ActionState> {
  const { orgId, role } = await requireOrgContext();
  try {
    assertAtLeast(role, "member");
  } catch {
    return { error: "You don't have permission to do that." };
  }

  const count = await prisma.competitor.count({ where: { orgId } });
  if (count > 0) {
    return { error: "Your workspace already has competitors." };
  }

  await seedDemoData(prisma, orgId);
  revalidatePath("/app");
  revalidatePath("/app/review");
  return { message: "Sample intel loaded — explore the feed." };
}
