import { describe, it, expect } from "vitest";
import {
  resolveMembership,
  orgScopedWhere,
  hasAtLeast,
  assertAtLeast,
  OrgScopeError,
  type Membership,
} from "@/lib/org-scope";

const ORG_A = "00000000-0000-0000-0000-00000000000a";
const ORG_B = "00000000-0000-0000-0000-00000000000b";
const USER_1 = "11111111-1111-1111-1111-111111111111";
const USER_2 = "22222222-2222-2222-2222-222222222222";

const memberships: Membership[] = [
  { orgId: ORG_A, userId: USER_1, role: "admin" },
  { orgId: ORG_B, userId: USER_2, role: "owner" },
];

describe("resolveMembership — tenant isolation", () => {
  it("resolves a user's membership in their own org", () => {
    const m = resolveMembership(memberships, USER_1, ORG_A);
    expect(m.role).toBe("admin");
  });

  it("refuses a user reaching into another org (the core RLS guarantee)", () => {
    expect(() => resolveMembership(memberships, USER_1, ORG_B)).toThrow(
      OrgScopeError,
    );
  });

  it("refuses an unknown user", () => {
    expect(() =>
      resolveMembership(memberships, "ghost", ORG_A),
    ).toThrow(/no membership/);
  });
});

describe("orgScopedWhere", () => {
  it("always injects the org id into a query filter", () => {
    expect(orgScopedWhere(ORG_A, { status: "new" })).toEqual({
      status: "new",
      orgId: ORG_A,
    });
  });

  it("works with no base filter", () => {
    expect(orgScopedWhere(ORG_A)).toEqual({ orgId: ORG_A });
  });

  it("cannot override the org id from the base filter", () => {
    const where = orgScopedWhere(ORG_A, {
      orgId: ORG_B,
    } as unknown as Record<string, unknown>);
    expect(where.orgId).toBe(ORG_A);
  });

  it("refuses to build a query with an empty org id", () => {
    expect(() => orgScopedWhere("")).toThrow(OrgScopeError);
  });
});

describe("role gating", () => {
  it("ranks roles correctly", () => {
    expect(hasAtLeast("owner", "admin")).toBe(true);
    expect(hasAtLeast("member", "admin")).toBe(false);
    expect(hasAtLeast("viewer", "viewer")).toBe(true);
  });

  it("assertAtLeast throws below the required role", () => {
    expect(() => assertAtLeast("viewer", "member")).toThrow(OrgScopeError);
    expect(() => assertAtLeast("admin", "member")).not.toThrow();
  });
});
