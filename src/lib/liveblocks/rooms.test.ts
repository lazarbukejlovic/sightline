import { describe, it, expect } from "vitest";
import {
  battlecardRoomId,
  orgRoomPattern,
  roomBelongsToOrg,
  roomAccessForRole,
  canEdit,
} from "@/lib/liveblocks/rooms";

const ORG_A = "00000000-0000-0000-0000-00000000000a";
const ORG_B = "00000000-0000-0000-0000-00000000000b";
const BC = "11111111-1111-1111-1111-111111111111";

describe("room naming + tenant isolation", () => {
  it("namespaces battlecard rooms by org", () => {
    expect(battlecardRoomId(ORG_A, BC)).toBe(`org:${ORG_A}:battlecard:${BC}`);
  });

  it("grants only the org's wildcard pattern", () => {
    expect(orgRoomPattern(ORG_A)).toBe(`org:${ORG_A}:*`);
  });

  it("recognizes a room as belonging to its own org", () => {
    expect(roomBelongsToOrg(battlecardRoomId(ORG_A, BC), ORG_A)).toBe(true);
  });

  it("rejects another org's room (the core isolation guarantee)", () => {
    expect(roomBelongsToOrg(battlecardRoomId(ORG_A, BC), ORG_B)).toBe(false);
  });

  it("is not fooled by an org id that is a prefix of another", () => {
    // `org:a:...` must not match org id `org:a:evil` style spoofing.
    expect(roomBelongsToOrg(`org:${ORG_A}x:battlecard:${BC}`, ORG_A)).toBe(false);
  });
});

describe("role → room access", () => {
  it("lets owner/admin/member edit", () => {
    for (const role of ["owner", "admin", "member"] as const) {
      expect(roomAccessForRole(role)).toBe("full");
      expect(canEdit(role)).toBe(true);
    }
  });

  it("makes viewer read-only", () => {
    expect(roomAccessForRole("viewer")).toBe("read");
    expect(canEdit("viewer")).toBe(false);
  });
});
