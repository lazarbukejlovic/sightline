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

  const existing = await prisma.membership.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: { orgId: true, role: true },
  });

  if (existing) {
    return { user, orgId: existing.orgId, role: existing.role as Role };
  }

  // Bootstrap a personal workspace. The profile row already exists (auth
  // trigger from 0001_rls_and_triggers.sql).
  const name =
    (user.user_metadata?.full_name as string | undefined)?.trim() ||
    user.email?.split("@")[0] ||
    "My workspace";
  const workspaceName = name.endsWith("workspace") ? name : `${name}'s workspace`;

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

  return { user, orgId: membership.orgId, role: membership.role as Role };
}
