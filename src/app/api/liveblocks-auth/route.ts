import { requireOrgContext } from "@/lib/org/context";
import { getLiveblocks, liveblocksConfigured } from "@/lib/liveblocks/server";
import { orgRoomPattern, roomAccessForRole } from "@/lib/liveblocks/rooms";
import { userColor } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Liveblocks auth. Grants the session access ONLY to the caller's own-org room
 * pattern (`org:{orgId}:*`) — tenant isolation enforced server-side, so a user
 * can never join another org's rooms. Owner/Admin/Member get write access;
 * Viewer gets read-only; anyone else is denied.
 */
export async function POST() {
  if (!liveblocksConfigured()) {
    return new Response("Liveblocks is not configured.", { status: 501 });
  }

  const { user, orgId, role } = await requireOrgContext();
  const access = roomAccessForRole(role);
  if (access === "none") {
    return new Response("Forbidden", { status: 403 });
  }

  const name =
    (user.user_metadata?.full_name as string | undefined)?.trim() ||
    user.email?.split("@")[0] ||
    "Teammate";

  const liveblocks = getLiveblocks();
  const session = liveblocks.prepareSession(user.id, {
    userInfo: { name, color: userColor(user.id) },
  });

  session.allow(
    orgRoomPattern(orgId),
    access === "full" ? session.FULL_ACCESS : session.READ_ACCESS,
  );

  const { body, status } = await session.authorize();
  return new Response(body, { status });
}
