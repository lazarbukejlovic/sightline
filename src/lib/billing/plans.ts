/**
 * Plan definitions + feature gating (pure, no server imports → unit-testable).
 * The DB `Plan` enum (free | pro | team) maps 1:1 to these string values.
 */
export type Plan = "free" | "pro" | "team";

export const PLAN_RANK: Record<Plan, number> = { free: 0, pro: 1, team: 2 };

export const PLAN_LABEL: Record<Plan, string> = {
  free: "Free",
  pro: "Pro",
  team: "Team",
};

export interface PlanLimits {
  /** Max competitors an org may track (Infinity = unlimited). */
  competitors: number;
  /** Inngest scheduled monitoring (Free is manual "Scan now" only). */
  scheduledMonitoring: boolean;
  /** Collaborative battlecards. */
  battlecards: boolean;
  /** Weekly digest generation. */
  digests: boolean;
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    competitors: 1,
    scheduledMonitoring: false,
    battlecards: false,
    digests: false,
  },
  pro: {
    competitors: 25,
    scheduledMonitoring: true,
    battlecards: true,
    digests: true,
  },
  team: {
    competitors: Number.POSITIVE_INFINITY,
    scheduledMonitoring: true,
    battlecards: true,
    digests: true,
  },
};

export function isPaid(plan: Plan): boolean {
  return plan !== "free";
}

export function competitorLimit(plan: Plan): number {
  return PLAN_LIMITS[plan].competitors;
}

/** Whether a plan unlocks a boolean feature. */
export function planAllows(
  plan: Plan,
  feature: "scheduledMonitoring" | "battlecards" | "digests",
): boolean {
  return PLAN_LIMITS[plan][feature];
}

/** Whether the org can add another competitor given its current count. */
export function canAddCompetitor(plan: Plan, currentCount: number): boolean {
  return currentCount < competitorLimit(plan);
}
