/**
 * Liveblocks global type augmentation. Defines the shape of `UserMeta.info`
 * (set by the auth endpoint, read by the avatar stack) and an empty Presence —
 * live cursors are driven by Yjs awareness via CodeMirror, not Liveblocks
 * presence.
 */
declare global {
  interface Liveblocks {
    UserMeta: {
      id: string;
      info: {
        name: string;
        color: string;
      };
    };
    Presence: Record<string, never>;
  }
}

export {};
