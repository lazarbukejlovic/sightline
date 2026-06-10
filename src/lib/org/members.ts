import "server-only";
import { prisma } from "@/lib/db/prisma";
import type { Role } from "@/lib/org-scope";

export interface OrgMember {
  userId: string;
  name: string;
  role: Role;
}

/** List the members of an org (for assignment dropdowns, mention lists, etc.). */
export async function listOrgMembers(orgId: string): Promise<OrgMember[]> {
  const memberships = await prisma.membership.findMany({
    where: { orgId },
    orderBy: { createdAt: "asc" },
    include: { profile: { select: { id: true, fullName: true } } },
  });

  return memberships.map((m) => ({
    userId: m.userId,
    name: m.profile.fullName?.trim() || "Teammate",
    role: m.role as Role,
  }));
}
