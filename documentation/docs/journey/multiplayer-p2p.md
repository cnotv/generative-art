---
sidebar_position: 12
---

# Multiplayer P2P

Adding real-time P2P multiplayer using WebRTC via [Trystero](https://github.com/dmotz/trystero) (NOSTR signaling — no dedicated server required).

## Package split: client, server, P2P

The initial `@webgamekit/multiplayer` was a Socket.IO client only. It was replaced by three focused packages:

| Package                          | Role                                                     |
| -------------------------------- | -------------------------------------------------------- |
| `@webgamekit/multiplayer-client` | Socket.IO client — connects to a dedicated server        |
| `@webgamekit/multiplayer-server` | Socket.IO server — Node.js only, manages player registry |
| `@webgamekit/multiplayer-p2p`    | WebRTC via Trystero — fully serverless                   |

## Why Trystero over PeerJS

PeerJS requires a signaling server you own and is no longer actively maintained. Trystero uses public NOSTR relays as a signaling layer — no account, no server, no configuration. The tradeoff is that NOSTR relay availability is out of your control, but multiple redundant relays are used by default.

## Bug: DataPayload type constraint

**Symptom:** TypeScript error `Type 'PlayerPosition' does not satisfy constraint 'DataPayload'`.

**Cause:** Trystero's `makeAction<T>` requires `T extends DataPayload`. `DataPayload` includes `JsonValue`, which requires `{ [key: string]: JsonValue }` index signatures on all objects. A plain `interface { x: number; y: number; z: number }` doesn't satisfy this.

**Fix:** Use intersection types to add the index signature without changing the named fields:

```ts
// Does not satisfy DataPayload — missing index signature
interface PlayerPosition {
  x: number
  y: number
  z: number
}

// Satisfies DataPayload
type PlayerPosition = { x: number; y: number; z: number } & Record<string, number>
```

For generic data channels constrain the type parameter:

```ts
export const p2pSendData = <T extends DataPayload>(
  session: P2PSession,
  channel: string,
  payload: T
): void => { ... }
```

## Bug: TypeScript can't resolve Trystero types

**Symptom:** `Cannot find module '@trystero-p2p/core' or its corresponding type declarations`.

**Cause:** Two sub-issues:

1. `@trystero-p2p/core` is a transitive dependency — not directly importable.
2. Trystero ships `.d.mts` declaration files alongside `.mjs` entry points. TypeScript's `Node` `moduleResolution` cannot resolve `.d.mts` files.

**Fix:** Import types from `trystero/nostr` (which re-exports everything via `export *`), and set `"moduleResolution": "Bundler"` in the package `tsconfig.json`:

```ts
import type { Room, DataPayload } from 'trystero/nostr'
```

```json
{ "compilerOptions": { "moduleResolution": "Bundler" } }
```

## Bug: crypto.subtle crash in Vite pre-bundling

**Symptom:** `TypeError: Cannot read properties of undefined (reading 'digest')` thrown at startup.

**Cause:** Vite's dependency pre-optimizer runs in Node.js before the browser loads. Trystero calls `crypto.subtle.digest` at module initialization (to hash room IDs). Node.js doesn't expose `crypto.subtle` globally during Vite's pre-bundling phase.

**Fix:** Exclude Trystero from Vite's optimizer so it is served as native ESM directly to the browser:

```ts
// vite.config.ts
optimizeDeps: {
  exclude: ['@dimforge/rapier3d-compat', 'trystero', 'trystero/nostr']
}
```

## Bug: crypto.subtle unavailable on plain HTTP origins

**Symptom:** `TypeError: Cannot read properties of undefined (reading 'importKey')` at runtime when accessing the app over HTTP on a custom hostname.

**Cause:** `crypto.subtle` (the Web Crypto API) is only available in secure contexts — HTTPS or `localhost`. Browsers deliberately block it on plain HTTP to prevent key extraction. All Trystero strategies use `crypto.subtle` for room ID hashing, so none will work on plain HTTP.

**Fix:** Add a pre-flight check before calling `joinRoom`, and surface a clear error in the UI:

```ts
export const p2pIsSupported = (): boolean => {
  return typeof window !== 'undefined' && typeof window.crypto?.subtle !== 'undefined'
}
```

The view calls this on mount and shows a banner if the app isn't on HTTPS/localhost instead of silently failing.

## Bug: torrent WebSocket trackers fail to connect

**Symptom:** Switched to `@trystero-p2p/torrent` to avoid `crypto.subtle`, but `WebSocket connection to 'wss://tracker.webtorrent.dev/' failed`.

**Cause:** The public BitTorrent WebSocket trackers used by the torrent strategy (`tracker.webtorrent.dev`, `tracker.btorrent.xyz`) are unreliable. Peers can never discover each other when trackers are down.

**Fix:** Switch back to `trystero/nostr`. The torrent strategy was only chosen to avoid `crypto.subtle`, but that issue is better solved with `p2pIsSupported()` + HTTPS. NOSTR relays are more reliably available.

## Bug: peers only appear after broadcasting a position

**Symptom:** After joining a room, the peer list shows 0 peers even though another tab is connected.

**Cause:** The peer list was populated only via `p2pOnPlayers` (position data). There was no join/leave tracking — a peer only appeared once they sent their first position.

**Fix:** Use `room.onPeerJoin` and `room.onPeerLeave` to track peer presence independently of position data:

```ts
export const p2pOnPeerJoin = (session: P2PSession, callback: (peerId: string) => void): void => {
  session.room.onPeerJoin(callback)
}
```

Peers now appear immediately on join with "waiting for position…" until their first broadcast arrives.

## Bug: first tab doesn't see second tab until a third tab joins

**Symptom:** Open tab A (already in room), open tab B — B doesn't appear in A's peer list. Open tab C, and suddenly all three tabs see each other.

**Cause:** `onPeerJoin` only fires for peers who join _after_ you register the callback. If tab B was already in the room when tab A joined, A's `onPeerJoin` never fired for B. Tab C joining triggered a new round of peer handshakes, which is what made B visible to A.

**Fix:** Call `room.getPeers()` immediately after joining to get the list of already-connected peers:

```ts
export const p2pGetPeerIds = (session: P2PSession): string[] => Object.keys(session.room.getPeers())
```

Call this right after registering `onPeerJoin` and add any returned IDs to the peer list:

```ts
p2pOnPeerJoin(newSession, (peerId) => {
  /* add to list */
})

// Catch peers already in the room
p2pGetPeerIds(newSession).forEach((peerId) => {
  /* add to list */
})
```

## Testing strategy

Unit tests mock `trystero/nostr` but only verify individual functions in isolation. They don't catch cross-peer bugs — a mock that registers a callback without ever invoking it will pass even if the whole peer communication chain is broken.

The integration test uses a room-aware mock that routes sends between sessions and fires `onPeerJoin`/`onPeerLeave` across all sessions, matching real Trystero behavior. It also implements `getPeers()` returning the actual connected peer map to test the late-joiner fix:

```ts
getPeers: () =>
  Object.fromEntries([...room.entries()].filter(([id]) => id !== peerId).map(([id]) => [id, {}]))
```

Key scenarios tested:

- Peer A sees Peer B join via `onPeerJoin`
- Peer A receives Peer B's position broadcast
- Peer A is notified when Peer B leaves
- Peer A sees Peer B via `p2pGetPeerIds` when A joins after B (late-joiner fix)
- Sender does not receive their own broadcast
- Three-peer scenario: both B and C appear in A's list
