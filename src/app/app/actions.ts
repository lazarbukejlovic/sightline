"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireOrgContext } from "@/lib/org/context";
import { assertAtLeast } from "@/lib/org-scope";
import { scanSource as runScan } from "@/lib/scan";

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
