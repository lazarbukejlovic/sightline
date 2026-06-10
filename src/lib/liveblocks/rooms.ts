/**
 * Pure helpers for Liveblocks room naming + access (no server imports, testable).
 *
 * Tenant isolation rule: every room id is namespaced `org:{orgId}:...`. The auth
 * endpoint only ever grants a session access to the `org:{orgId}:*` pattern for
 * the caller's resolved org, so a user can never join another org's rooms.
 */
import type { Role } from "@/lib/org-scope";

/** The room id for a competitor's battlecard. */
export function battlecardRoomId(orgId: string, battlecardId: string): string {
  return `org:${orgId}:battlecard:${battlecardId}`;
}

/** The wildcard pattern a session is granted for its org. */
export function orgRoomPattern(orgId: string): string {
  return `org:${orgId}:*`;
}

/** True only if a room id belongs to the given org (defense-in-depth check). */
export function roomBelongsToOrg(roomId: string, orgId: string): boolean {
  return roomId.startsWith(`org:${orgId}:`);
}

export type RoomAccess = "full" | "read" | "none";

/**
 * Map a membership role to a room access level. Owner/Admin/Member may edit;
 * Viewer is read-only; anything else gets nothing. Enforced server-side in the
 * auth endpoint (the editor is also visually read-only for viewers).
 */
export function roomAccessForRole(role: Role): RoomAccess {
  switch (role) {
    case "owner":
    case "admin":
    case "member":
      return "full";
    case "viewer":
      return "read";
    default:
      return "none";
  }
}

/** Can this role write (edit battlecards, comment, assign, resolve suggestions)? */
export function canEdit(role: Role): boolean {
  return roomAccessForRole(role) === "full";
}
