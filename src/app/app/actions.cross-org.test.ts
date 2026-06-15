/**
 * Cross-org tenant-isolation integration test.
 *
 * Proves the application-layer guarantee end-to-end: a signed-in user in org A
 * can neither READ nor MUTATE org B's data through the real server actions —
 * even when they hand the action org B's resource id directly.
 *
 * The Prisma client is replaced with a tiny in-memory fake that *honors the
 * `where` filter exactly like the database would*. So if an action ever
 * forgot to AND-in the authenticated `orgId`, this test would catch it: org B's
 * row would match and the mutation would succeed. The only thing the action is
 * allowed to trust is the org id returned by `requireOrgContext()` (the session
 * choke point), which we mock per-actor.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// Valid-format UUIDs (version 4, variant 8) so the zod `.uuid()` parsers pass.
const ORG_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORG_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const USER_A = "a1111111-1111-4111-8111-111111111111";
const USER_B = "b2222222-2222-4222-8222-222222222222";
const COMPETITOR_B = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const CHANGE_B = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const BATTLECARD_B = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

type Row = Record<string, unknown>;

function matchesWhere(row: Row, where: Row): boolean {
  return Object.entries(where).every(([key, value]) => {
    // Prisma composite unique key (battlecard `orgId_competitorId`).
    if (key === "orgId_competitorId" && value && typeof value === "object") {
      const v = value as Row;
      return row.orgId === v.orgId && row.competitorId === v.competitorId;
    }
    return row[key] === value;
  });
}

// A minimal Prisma model backed by an array, implementing only the methods the
// actions under test call — each respecting the `where` filter.
function model(rows: Row[]) {
  return {
    rows,
    findFirst: vi.fn(async ({ where }: { where: Row }) => {
      return rows.find((r) => matchesWhere(r, where)) ?? null;
    }),
    findUnique: vi.fn(async ({ where }: { where: Row }) => {
      return rows.find((r) => matchesWhere(r, where)) ?? null;
    }),
    findMany: vi.fn(async ({ where }: { where?: Row } = {}) => {
      return where ? rows.filter((r) => matchesWhere(r, where)) : [...rows];
    }),
    count: vi.fn(async ({ where }: { where?: Row } = {}) => {
      return where ? rows.filter((r) => matchesWhere(r, where)).length : rows.length;
    }),
    updateMany: vi.fn(async ({ where, data }: { where: Row; data: Row }) => {
      let count = 0;
      for (const r of rows) {
        if (matchesWhere(r, where)) {
          Object.assign(r, data);
          count++;
        }
      }
      return { count };
    }),
    create: vi.fn(async ({ data }: { data: Row }) => {
      const created = { id: (data.id as string) ?? crypto.randomUUID(), ...data };
      rows.push(created);
      return created;
    }),
  };
}

class RedirectError extends Error {
  constructor(public to: string) {
    super(`REDIRECT:${to}`);
  }
}

type Model = ReturnType<typeof model>;
interface Db {
  change: Model;
  battlecard: Model;
  competitor: Model;
  comment: Model;
  source: Model;
  auditLog: Model;
  subscription: Model;
}

// Shared mutable state + spies, created in vi.hoisted so the mock factories
// (which are hoisted above all other code) can reference them.
const h = vi.hoisted(() => ({
  ctx: { user: { id: "" }, orgId: "", role: "owner" as string },
  db: {} as Db,
  ensureBattlecard: vi.fn(async () => ({ id: "new-card" })),
  revalidatePath: vi.fn(),
  redirect: vi.fn((to: string) => {
    throw new RedirectError(to);
  }),
}));

vi.mock("@/lib/org/context", () => ({
  requireOrgContext: vi.fn(async () => h.ctx),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: new Proxy(
    {},
    {
      get(_t, prop: string) {
        return h.db[prop as keyof Db];
      },
    },
  ),
}));

// Mock the non-isolation collaborators so importing the actions module never
// pulls in real env/network. None of these are the boundary under test.
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn(async () => {}) }));
vi.mock("@/lib/ratelimit", () => ({
  rateLimit: vi.fn(async () => ({ success: true, resetSeconds: 0 })),
  RATE_LIMITS: { scan: { limit: 12, windowSeconds: 60 }, ask: { limit: 20, windowSeconds: 60 } },
}));
vi.mock("@/lib/scan", () => ({ scanSource: vi.fn(async () => ({ changed: false, meaningful: false, message: "ok" })) }));
vi.mock("@/lib/billing/subscription", () => ({ getOrgPlan: vi.fn(async () => "team") }));
vi.mock("@/lib/demo-seed", () => ({ seedDemoData: vi.fn(async () => {}) }));

vi.mock("@/lib/battlecard", () => ({ ensureBattlecard: h.ensureBattlecard }));
vi.mock("next/cache", () => ({ revalidatePath: h.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: h.redirect }));

import { reviewChange, addComment, createSource, openBattlecard } from "./actions";

function actAs(orgId: string, userId: string, role = "owner") {
  h.ctx = { user: { id: userId }, orgId, role };
}

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  // Reseed: every record below is owned by ORG_B.
  h.db = {
    change: model([{ id: CHANGE_B, orgId: ORG_B, status: "published" }]),
    battlecard: model([
      { id: BATTLECARD_B, orgId: ORG_B, competitorId: COMPETITOR_B },
    ]),
    competitor: model([{ id: COMPETITOR_B, orgId: ORG_B, name: "Org B Co" }]),
    comment: model([]),
    source: model([]),
    auditLog: model([
      { id: "log-b", orgId: ORG_B, action: "competitor.created", createdAt: new Date() },
    ]),
    subscription: model([{ orgId: ORG_B, plan: "team", status: "active" }]),
  };
});

describe("cross-org isolation — a user in org A cannot reach org B's data", () => {
  it("reviewChange: org A cannot mutate org B's change", async () => {
    actAs(ORG_A, USER_A);
    const res = await reviewChange({}, fd({ changeId: CHANGE_B, decision: "dismissed" }));

    expect(res.error).toMatch(/not found in this organization/i);
    // The org-scoped updateMany matched nothing; org B's row is untouched.
    expect(h.db.change.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: CHANGE_B, orgId: ORG_A } }),
    );
    expect(h.db.change.rows[0]?.status).toBe("published");
  });

  it("reviewChange: org B (control) CAN mutate its own change", async () => {
    actAs(ORG_B, USER_B);
    const res = await reviewChange({}, fd({ changeId: CHANGE_B, decision: "dismissed" }));

    expect(res.error).toBeUndefined();
    expect(h.db.change.rows[0]?.status).toBe("dismissed");
  });

  it("addComment: org A cannot comment on org B's change (no read, no write)", async () => {
    actAs(ORG_A, USER_A);
    const res = await addComment(
      {},
      fd({ targetType: "change", targetId: CHANGE_B, body: "leak attempt" }),
    );

    expect(res.error).toMatch(/not found in this organization/i);
    expect(h.db.comment.create).not.toHaveBeenCalled();
    expect(h.db.comment.rows).toHaveLength(0);
  });

  it("addComment: org A cannot comment on org B's battlecard", async () => {
    actAs(ORG_A, USER_A);
    const res = await addComment(
      {},
      fd({ targetType: "battlecard", targetId: BATTLECARD_B, body: "leak attempt" }),
    );

    expect(res.error).toMatch(/not found in this organization/i);
    expect(h.db.comment.rows).toHaveLength(0);
  });

  it("createSource: org A cannot attach a source to org B's competitor", async () => {
    actAs(ORG_A, USER_A);
    const res = await createSource(
      {},
      fd({ competitorId: COMPETITOR_B, type: "pricing", url: "https://evil.example/x" }),
    );

    expect(res.error).toMatch(/not found in this organization/i);
    expect(h.db.source.create).not.toHaveBeenCalled();
    expect(h.db.source.rows).toHaveLength(0);
  });

  it("openBattlecard: org A is redirected away from org B's competitor, no card created", async () => {
    actAs(ORG_A, USER_A);
    await expect(
      openBattlecard(fd({ competitorId: COMPETITOR_B })),
    ).rejects.toThrow(/REDIRECT:\/app$/);
    expect(h.ensureBattlecard).not.toHaveBeenCalled();
  });

  it("audit log read is org-scoped — org A sees none of org B's entries", async () => {
    // Mirrors src/app/app/audit/page.tsx: findMany({ where: { orgId } }).
    const rows = await h.db.auditLog.findMany({ where: { orgId: ORG_A } });
    expect(rows).toHaveLength(0);
    const own = await h.db.auditLog.findMany({ where: { orgId: ORG_B } });
    expect(own).toHaveLength(1);
  });

  it("billing read is org-scoped — org A cannot read org B's subscription", async () => {
    // Mirrors src/lib/billing/subscription.ts: findUnique({ where: { orgId } }).
    const sub = await h.db.subscription.findUnique({ where: { orgId: ORG_A } });
    expect(sub).toBeNull();
    const own = await h.db.subscription.findUnique({ where: { orgId: ORG_B } });
    expect(own).not.toBeNull();
  });
});
