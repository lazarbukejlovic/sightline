import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { battlecardRoomId } from "@/lib/liveblocks/rooms";

export interface BattlecardRecord {
  id: string;
  roomId: string;
  title: string;
}

/**
 * Get the competitor's battlecard, creating it (with a deterministic,
 * org-namespaced Liveblocks room id) on first use. One battlecard per
 * competitor, enforced by the (org_id, competitor_id) unique constraint.
 */
export async function ensureBattlecard(
  orgId: string,
  competitorId: string,
  title: string,
): Promise<BattlecardRecord> {
  const existing = await prisma.battlecard.findUnique({
    where: { orgId_competitorId: { orgId, competitorId } },
    select: { id: true, roomId: true, title: true },
  });
  if (existing) return existing;

  // Generate the id app-side so the room id is known before insert.
  const id = randomUUID();
  const roomId = battlecardRoomId(orgId, id);

  try {
    const created = await prisma.battlecard.create({
      data: { id, orgId, competitorId, title, roomId },
      select: { id: true, roomId: true, title: true },
    });
    return created;
  } catch {
    // Lost a create race — fetch the row the other writer created.
    const row = await prisma.battlecard.findUnique({
      where: { orgId_competitorId: { orgId, competitorId } },
      select: { id: true, roomId: true, title: true },
    });
    if (row) return row;
    throw new Error("Failed to create or load the battlecard.");
  }
}
