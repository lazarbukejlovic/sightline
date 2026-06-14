import { describe, it, expect } from "vitest";
import {
  isPaid,
  competitorLimit,
  planAllows,
  canAddCompetitor,
  PLAN_RANK,
} from "@/lib/billing/plans";

describe("plan gating", () => {
  it("ranks plans", () => {
    expect(PLAN_RANK.free).toBeLessThan(PLAN_RANK.pro);
    expect(PLAN_RANK.pro).toBeLessThan(PLAN_RANK.team);
  });

  it("treats only pro/team as paid", () => {
    expect(isPaid("free")).toBe(false);
    expect(isPaid("pro")).toBe(true);
    expect(isPaid("team")).toBe(true);
  });

  it("gates scheduled monitoring + battlecards to paid plans", () => {
    expect(planAllows("free", "scheduledMonitoring")).toBe(false);
    expect(planAllows("free", "battlecards")).toBe(false);
    expect(planAllows("pro", "scheduledMonitoring")).toBe(true);
    expect(planAllows("team", "battlecards")).toBe(true);
  });

  it("limits free to one competitor", () => {
    expect(competitorLimit("free")).toBe(1);
    expect(canAddCompetitor("free", 0)).toBe(true);
    expect(canAddCompetitor("free", 1)).toBe(false);
  });

  it("allows many competitors on pro and unlimited on team", () => {
    expect(canAddCompetitor("pro", 10)).toBe(true);
    expect(competitorLimit("team")).toBe(Number.POSITIVE_INFINITY);
    expect(canAddCompetitor("team", 9999)).toBe(true);
  });
});
