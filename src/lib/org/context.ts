import "server-only";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import type { Role } from "@/lib/org-scope";

export interface OrgContext {
  user: User;
  orgId: string;
  role: Role;
}

function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${base || "workspace"}-${suffix}`;
}

/**
 * Idempotent onboarding for an authenticated Supabase user. Safe to run on
 * every request and to run concurrently/repeatedly without creating duplicates.
 *
 * Order matters: the app-level `profiles` row MUST exist before any membership
 * is created, because `memberships.user_id` has a foreign key to `profiles.id`.
 * A DB trigger (0001_rls_and_triggers.sql) normally creates the profile on
 * signup, but we no longer DEPEND on it being installed/committed in time —
 * upserting here makes new-user onboarding self-healing and fixes the P2003
 * (memberships_user_id_fkey) crash on first visit to /app.
 *
 * Prisma connects with a privileged role that bypasses RLS, so these writes are
 * not blocked by (and do not weaken) the row-level security policies.
 */
async function ensureUserAndWorkspace(
  user: User,
): Promise<{ orgId: string; role: Role }> {
  // 1. Ensure the Profile row exists FIRST (the membership FK target).
  await prisma.profile.upsert({
    where: { id: user.id },
    update: {},
    create: {
      id: user.id,
      fullName:
        (user.user_metadata?.full_name as string | undefined) ??
        (user.user_metadata?.name as string | undefined) ??
        null,
      avatarUrl: (user.user_metadata?.avatar_url as string | undefined) ?? null,
    },
  });

  // 2. Already a member of an org? Use it.
  const existing = await prisma.membership.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: { orgId: true, role: true },
  });
  if (existing) {
    return { orgId: existing.orgId, role: existing.role as Role };
  }

  // 3. Bootstrap a personal workspace + owner membership.
  const name =
    (user.user_metadata?.full_name as string | undefined)?.trim() ||
    user.email?.split("@")[0] ||
    "My workspace";
  const workspaceName = name.endsWith("workspace") ? name : `${name}'s workspace`;

  try {
    const membership = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { name: workspaceName, slug: slugify(workspaceName) },
        select: { id: true },
      });
      return tx.membership.create({
        data: { orgId: org.id, userId: user.id, role: "owner" },
        select: { orgId: true, role: true },
      });
    });
    return { orgId: membership.orgId, role: membership.role as Role };
  } catch {
    // Lost a race with a concurrent first-visit request: a membership now
    // exists. Re-read it instead of failing the page render.
    const recovered = await prisma.membership.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
      select: { orgId: true, role: true },
    });
    if (recovered) {
      return { orgId: recovered.orgId, role: recovered.role as Role };
    }
    throw new Error("Could not initialize your workspace. Please retry.");
  }
}

/**
 * Resolve the authenticated user's active organization, creating a personal
 * workspace + owner membership on first use. Redirects to sign-in if there is
 * no session. This is the single choke point every server mutation/query goes
 * through to obtain a verified org_id — never trust a client-supplied one.
 */
export async function requireOrgContext(): Promise<OrgContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in?next=/app");
  }

  const { orgId, role } = await ensureUserAndWorkspace(user);
  return { user, orgId, role };
}
