# Phase 5 · Item 7 — Self-hosted Yjs (Hocuspocus): decision

**Decision: kept Liveblocks on `main`. Did NOT swap.**

The instruction was explicit: do the swap on a separate branch and *only merge if
real-time verifies identically* (two-session sync, presence, live cursors, room
isolation); otherwise stop, keep Liveblocks, and report — do not ship degraded
real-time.

A clean Hocuspocus swap requires a **separate always-on WebSocket host** (the
battlecard editor needs a persistent `ws://` connection; Vercel's serverless
functions can't hold one). Standing that host up, wiring auth to replicate our
tenant-isolated room grants, and verifying two-browser parity (presence,
cursors, persistence, isolation) cannot be done and verified from this
environment without provisioning + deploying the worker. Per the rule, shipping
an unverified real-time swap is not acceptable, so **Liveblocks stays** and
real-time keeps working exactly as today.

This file is the concrete migration plan for when you want to execute it on a
branch and verify parity before merging.

## What would change

| Concern | Today (Liveblocks) | Hocuspocus target |
|---|---|---|
| Transport | Liveblocks cloud rooms | Self-hosted Hocuspocus WS server (Node) |
| Provider | `@liveblocks/yjs` `getYjsProviderForRoom` | `@hocuspocus/provider` `HocuspocusProvider` |
| Auth | `/api/liveblocks-auth` mints a token granting `org:{orgId}:*` | A short-lived **JWT** (org_id + room + can-edit) verified by the Hocuspocus server's `onAuthenticate` |
| Presence/cursors | Liveblocks awareness (Yjs) + `useOthers` avatars | Yjs **awareness** over the same provider (CodeMirror `yCollab` already uses awareness) + an avatar stack derived from awareness states |
| Persistence | Liveblocks storage | Hocuspocus `Database`/`onStoreDocument` extension → persist Yjs updates (e.g. to Postgres `battlecard_docs` or Redis) |
| Room isolation | grant pattern `org:{orgId}:*` | server rejects `onAuthenticate` unless the JWT's org matches the requested room's `org:{orgId}:...` name |

Comments + suggested edits are **unaffected** (already DB-backed, not Liveblocks).

## Steps (on a `phase5/hocuspocus` branch)

1. **Server** (`server/hocuspocus/`, deploy to Railway/Fly/Render — needs a
   long-lived process, not serverless):
   - `@hocuspocus/server` with `onAuthenticate` verifying a JWT signed by the app
     (`HOCUSPOCUS_JWT_SECRET`), asserting `payload.orgId` matches the room prefix
     and setting read-only when `!canEdit`.
   - A persistence extension storing Yjs updates keyed by room id.
2. **Token route** — replace `/api/liveblocks-auth` with `/api/collab-token`:
   `requireOrgContext()` → sign `{ sub: userId, orgId, room, canEdit, name, color }`
   (short TTL). Reuse `roomAccessForRole` + `battlecardRoomId` unchanged.
3. **Client** — in `battlecard-workspace.tsx`, replace
   `LiveblocksProvider`/`RoomProvider`/`getYjsProviderForRoom` with a
   `HocuspocusProvider({ url, name: roomId, token })`. Keep the **same** Y.Doc /
   `yCollab(yText, provider.awareness)` wiring — CodeMirror, cursors, and the
   ledger/document chrome stay identical. Rebuild the avatar stack from
   `provider.awareness.getStates()`.
4. **Env** (placeholders only): `NEXT_PUBLIC_HOCUSPOCUS_URL` (e.g.
   `wss://collab.yourapp.com`), `HOCUSPOCUS_JWT_SECRET`.

## Parity gate before merge

Merge only if, against the branch deploy, all of these hold identically to
Liveblocks today:

- [ ] Two browser sessions (same org) edit concurrently → conflict-free merge.
- [ ] Live cursors + selections appear and move smoothly across sessions.
- [ ] Presence avatar stack updates on join/leave.
- [ ] Reload persists the document.
- [ ] A user from a **different org** is rejected from the room (isolation).
- [ ] Viewer role is read-only.

If any fail, keep Liveblocks.

## New host/cost note

Hocuspocus needs one small always-on Node instance (Railway/Fly free/hobby
tier). That is the main operational trade vs. Liveblocks' managed cloud.
