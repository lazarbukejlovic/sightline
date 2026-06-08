/**
 * App-layer multi-tenant scoping.
 *
 * RLS in Postgres is the database-level defense (see prisma/migrations).
 * This module is the *application-level* second layer: every server query
 * must be scoped by an org_id that was resolved from the authenticated
 * session — never one supplied by the client.
 *
 * These helpers are intentionally pure so they can be unit-tested without a
 * database, proving that a caller cannot read across organizations.
 */

export type Role = "owner" | "admin" | "member" | "viewer";

export const ROLE_RANK: Record<Role, number> = {
  viewer: 0,
  member: 1,
  admin: 2,
  owner: 3,
};

export interface Membership {
  orgId: string;
  userId: string;
  role: Role;
}

export class OrgScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrgScopeError";
  }
}

/**
 * Resolve the membership a user has in a requested org, or throw. This is the
 * choke point: a client-supplied `requestedOrgId` is only honored if the user
 * actually belongs to it.
 */
export function resolveMembership(
  memberships: readonly Membership[],
  userId: string,
  requestedOrgId: string,
): Membership {
  const membership = memberships.find(
    (m) => m.userId === userId && m.orgId === requestedOrgId,
  );
  if (!membership) {
    throw new OrgScopeError(
      `User ${userId} has no membership in org ${requestedOrgId}`,
    );
  }
  return membership;
}

/**
 * Build the mandatory `where` filter for any org-owned table. Always merge
 * this into Prisma queries so a query can never be issued without an org_id.
 */
export function orgScopedWhere<T extends Record<string, unknown>>(
  orgId: string,
  where?: T,
): T & { orgId: string } {
  if (!orgId) {
    throw new OrgScopeError("Refusing to build a query without an orgId");
  }
  return { ...(where ?? ({} as T)), orgId };
}

/** Role gate for write/admin actions. */
export function hasAtLeast(role: Role, required: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[required];
}

export function assertAtLeast(role: Role, required: Role): void {
  if (!hasAtLeast(role, required)) {
    throw new OrgScopeError(
      `Role "${role}" is insufficient; "${required}" or higher required`,
    );
  }
}
