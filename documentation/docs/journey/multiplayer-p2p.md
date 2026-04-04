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

## DataPayload constraint

Trystero's `makeAction<T>` has a strict generic constraint: `T extends DataPayload`, where `DataPayload = JsonValue | Blob | ArrayBuffer | ArrayBufferView`. `JsonValue` requires `{ [key: string]: JsonValue }` index signatures on all nested objects.

Plain interfaces like `{ x: number; y: number; z: number }` do not satisfy this because they lack an index signature. The fix is intersection types:

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

For generic data channels where the caller controls the type, constrain the generic:

```ts
export const p2pSendData = <T extends DataPayload>(
  session: P2PSession,
  channel: string,
  payload: T
): void => {
  const [send] = session.room.makeAction<T>(channel)
  send(payload)
}
```

## Module resolution: Bundler required

Trystero ships `.d.mts` declaration files alongside `.mjs` entry points, accessed via subpath exports (`trystero/nostr`). TypeScript's classic `Node` moduleResolution cannot resolve `.d.mts` files. Set `"moduleResolution": "Bundler"` in the package `tsconfig.json`:

```json
{ "compilerOptions": { "moduleResolution": "Bundler" } }
```

## Import path for Trystero types

`@trystero-p2p/core` is a transitive dependency, not directly installable. Importing types from it fails:

```ts
// Fails — not in local node_modules
import type { Room, DataPayload } from '@trystero-p2p/core'
```

Instead, import from `trystero/nostr`, which re-exports everything from `@trystero-p2p/core` via `export *`:

```ts
import type { Room, DataPayload } from 'trystero/nostr'
```

## Vite pre-bundling breaks crypto.subtle

Vite's dependency pre-optimizer runs in Node.js to bundle ESM packages ahead of time. Trystero calls `crypto.subtle.digest` at module initialization to generate `selfId`. Node.js requires `globalThis.crypto` to be explicitly set, which Vite does not do during pre-bundling, causing:

```
TypeError: Cannot read properties of undefined (reading 'digest')
```

Fix: exclude Trystero from Vite's optimizer so it is served as native ESM directly to the browser:

```ts
// vite.config.ts
optimizeDeps: {
  exclude: ['@dimforge/rapier3d-compat', 'trystero', 'trystero/nostr']
}
```

## Peers only appear after broadcasting a position

The initial implementation showed 0 peers until someone clicked "Broadcast position". The cause: the peer list was populated only via `p2pOnPlayers` (position data), with no join/leave tracking.

Trystero exposes `room.onPeerJoin` and `room.onPeerLeave`. Wrapping these lets the view react immediately to peer presence:

```ts
export const p2pOnPeerJoin = (session: P2PSession, callback: (peerId: string) => void): void => {
  session.room.onPeerJoin(callback)
}
```

The view now shows peers the moment they join, displaying "waiting for position…" until their first broadcast arrives.

## Testing strategy

Unit tests mock `trystero/nostr` and verify individual functions in isolation. But they do not catch cross-peer bugs — a test that only checks "callback was registered" passes even if the callback chain is broken.

The integration test uses a room-aware mock that routes sends to the other session's receivers and fires `onPeerJoin`/`onPeerLeave` across sessions, matching real WebRTC behavior:

```ts
// room-aware mock inside vi.mock('trystero/nostr', ...)
joinRoom: vi.fn((_config, roomId) => {
  const peerId = `peer-${nextPeerId++}`
  // ...
  // Notify all existing peers that this peer joined
  room.forEach((existingState) => {
    existingState.peerJoinCallbacks.forEach((cb) => cb(peerId))
  })
  return {
    makeAction: (channel) => {
      const send = (data) => {
        // Deliver to all other sessions' receivers
        room.forEach((otherState, otherId) => {
          if (otherId !== peerId) otherState.receivers.get(channel)?.(data, peerId)
        })
      }
      // ...
    }
  }
})
```

This catches bugs that unit tests miss — for example, a sender calling `makeAction` on every send (creating a new instance) overwriting the receiver registered by another session.
