---
sidebar_position: 8
---

# Package: @webgamekit/multiplayer-p2p

Serverless P2P multiplayer for browser games using WebRTC via [Trystero](https://github.com/dmotz/trystero) (NOSTR signaling — no dedicated server required).

## Installation

```bash
pnpm add @webgamekit/multiplayer-p2p
```

## Requirements

- **Secure context**: `crypto.subtle` is only available on HTTPS or `localhost`. Call `p2pIsSupported()` before joining any room.
- **Vite**: Exclude Trystero from the optimizer (see [vite.config.ts setup](#viteconfigts)).

## Core concepts

| Concept     | Description                                                                                             |
| ----------- | ------------------------------------------------------------------------------------------------------- |
| **Room**    | A named shared space identified by a string. All peers in the same room can communicate directly.       |
| **Session** | The handle returned by `p2pJoin()`. Carries `peerId`, the Trystero `room`, and a `destroy()` function.  |
| **Channel** | A typed data stream within a room, created via `makeAction`. Send to all peers or target specific ones. |

## Quick start

```typescript
import {
  p2pIsSupported,
  p2pJoin,
  p2pLeave,
  p2pGetPeerIds,
  p2pOnPeerJoin,
  p2pOnPeerLeave,
  p2pSendData,
  p2pOnData
} from '@webgamekit/multiplayer-p2p'

if (!p2pIsSupported()) {
  console.warn('P2P unavailable — serve over HTTPS or localhost')
}

const session = p2pJoin('my-game-room')

// Catch peers already in the room before we joined
p2pGetPeerIds(session).forEach((peerId) => console.log('already here:', peerId))

// Listen for future joins/leaves
p2pOnPeerJoin(session, (peerId) => console.log('joined:', peerId))
p2pOnPeerLeave(session, (peerId) => console.log('left:', peerId))

// Send typed data
p2pSendData(session, 'game:event', { type: 'score', value: 42 })
p2pOnData<{ type: string; value: number }>(session, 'game:event', (payload, fromPeerId) => {
  console.log(fromPeerId, 'scored', payload.value)
})

// Cleanup
p2pLeave(session)
```

## API reference

### Session

```typescript
p2pIsSupported(): boolean
p2pJoin(roomId: string, config?: P2PConfig): P2PSession
p2pLeave(session: P2PSession): void
p2pGetPeerIds(session: P2PSession): string[]
p2pOnPeerJoin(session: P2PSession, callback: (peerId: string) => void): void
p2pOnPeerLeave(session: P2PSession, callback: (peerId: string) => void): void
```

### Player position / rotation (built-in throttling)

```typescript
p2pSendPosition(session, position, rotation, config?): void  // throttled 30 ms
p2pOnPlayers(session, callback: (state: PlayerState) => void): () => void
```

### Actions (animations, events)

```typescript
p2pSendAction(session, actionName: string): void
p2pOnAction(session, callback: (peerId: string, action: PlayerAction) => void): () => void
```

### Generic typed channels

```typescript
p2pSendData<T extends DataPayload>(session, channel: string, payload: T): void
p2pOnData<T>(session, channel: string, callback: (payload: T, peerId: string) => void): () => void
```

### Matchmaking

See the [Matchmaker tutorial](#tutorial-matchmaker) below.

```typescript
p2pMatchmake(roomId, config?, onStatusChange): MatchmakeHandle
p2pLobbyJoin(lobbyRoomId, config?, callbacks: LobbyCallbacks): LobbyHandle
```

## Tutorial: Matchmaker

The matchmaker solves two separate needs:

| Need                                                                       | API            |
| -------------------------------------------------------------------------- | -------------- |
| **Status-only**: know when ≥1 peer is present in a shared room             | `p2pMatchmake` |
| **Request/accept flow**: browse online players and accept specific matches | `p2pLobbyJoin` |

---

### Simple matchmaking with `p2pMatchmake`

`p2pMatchmake` joins a shared room and emits `'searching'` / `'matched'` as peers arrive or leave. The caller decides what to do on each status change.

```typescript
import { p2pMatchmake, type MatchmakeStatus } from '@webgamekit/multiplayer-p2p'

const handle = p2pMatchmake(
  'my-game-lobby',
  undefined,
  (status: MatchmakeStatus, peerCount: number) => {
    if (status === 'matched') {
      console.log(`Matched! ${peerCount} other player(s) in the room.`)
      // start game using handle.session
    } else {
      console.log('Searching…')
    }
  }
)

// When the user clicks Cancel:
handle.stop()
```

**State machine**

```
idle  ──[join]──►  searching  ──[peer joins]──►  matched
                      ▲                             │
                      └────────[all peers leave]────┘
```

**`MatchmakeHandle`**

| Property  | Type         | Description                   |
| --------- | ------------ | ----------------------------- |
| `session` | `P2PSession` | Use to send/receive game data |
| `stop()`  | `() => void` | Leave the room and tear down  |

---

### Lobby with `p2pLobbyJoin`

`p2pLobbyJoin` provides a full request/accept/ignore negotiation layer on top of the room.  
Use it when players need to choose who they play with rather than auto-connecting.

```typescript
import { p2pLobbyJoin, type LobbyHandle, type MatchRequest } from '@webgamekit/multiplayer-p2p'

const handle: LobbyHandle = p2pLobbyJoin('my-game-lobby', undefined, {
  onPeerJoin: (peerId) => {
    // A new candidate appeared — send them a request
    handle.sendRequest(peerId, myCurrentGameRoomId)
  },
  onPeerLeave: (peerId) => {
    // Remove from candidate list
  },
  onRequest: (request: MatchRequest, fromPeerId: string) => {
    // Received a request from fromPeerId
    // Show in UI: "Player X wants to play" + Accept / Ignore buttons
    pendingRequests.push({ request, fromPeerId })
  },
  onAccepted: (requestId: string) => {
    // Our request was accepted — the peer is coming to our game room
    // No navigation needed for us; we can keep searching for more players
  },
  onIgnored: (requestId: string) => {
    // Our request was declined
  },
  onPeerName: (peerId, name) => {
    // The peer broadcast their display name
    peerNames[peerId] = name
  }
})

// Announce your own display name to all peers
handle.setName('Alice')

// Catch peers already in the lobby
handle.getPeerIds().forEach((peerId) => handle.sendRequest(peerId, myGameRoomId))

// --- When the user clicks Accept ---
handle.acceptRequest(pendingRequests[0].request, pendingRequests[0].fromPeerId)
// Then navigate to the request's gameRoomId:
// router.push(`?room=${pendingRequests[0].request.gameRoomId}`)

// --- When the user clicks Ignore ---
handle.ignoreRequest(pendingRequests[0].request, pendingRequests[0].fromPeerId)

// --- Cleanup ---
handle.stop()
```

**`LobbyHandle`**

| Method                                   | Description                                                                  |
| ---------------------------------------- | ---------------------------------------------------------------------------- |
| `getPeerIds()`                           | All peers currently in the lobby                                             |
| `setName(name)`                          | Broadcast a display name; auto-sent to future joiners                        |
| `sendRequest(targetPeerId, gameRoomId?)` | Send a targeted match request; `gameRoomId` defaults to an auto-generated ID |
| `acceptRequest(request, fromPeerId)`     | Accept an incoming request; the sender will receive `onAccepted`             |
| `ignoreRequest(request, fromPeerId)`     | Ignore; the sender will receive `onIgnored`                                  |
| `stop()`                                 | Leave the lobby                                                              |

**`LobbyCallbacks`**

| Callback                         | When it fires                       |
| -------------------------------- | ----------------------------------- |
| `onPeerJoin(peerId)`             | A new peer entered the lobby        |
| `onPeerLeave(peerId)`            | A peer left the lobby               |
| `onRequest(request, fromPeerId)` | Received a targeted match request   |
| `onAccepted(requestId)`          | Our outgoing request was accepted   |
| `onIgnored(requestId)`           | Our outgoing request was ignored    |
| `onPeerName(peerId, name)`       | A peer broadcast their display name |

---

### Room ID strategy

The `gameRoomId` carried in a request is the ID both sides will use for the game.  
**Do not auto-generate a new room** — pass the host's existing game room ID so the shared link keeps working:

```typescript
// ✅ Advertise your existing room
handle.sendRequest(peerId, currentGameRoomId)

// ❌ Generates a fresh room neither player can reach via share link
handle.sendRequest(peerId)
```

When the acceptor receives `onRequest`, they should navigate to `request.gameRoomId`:

```typescript
onRequest: (request, fromPeerId) => {
  if (userClicksAccept) {
    handle.acceptRequest(request, fromPeerId)
    handle.stop()
    router.push(`?room=${request.gameRoomId}`)
  }
}
```

The requester stays in their room and keeps searching — additional players can join via the share link or the matchmaker.

---

### Vue integration example (Pictionary pattern)

```typescript
// In a Vue component
const lobbyHandle = ref<LobbyHandle | null>(null)
const pendingRequests = ref<Array<{ request: MatchRequest; fromPeerId: string }>>([])

const startSearching = (): void => {
  if (!p2pIsSupported() || lobbyHandle.value) return

  const handle = p2pLobbyJoin('pictionary-matchmaker', undefined, {
    onPeerJoin: (peerId) => handle.sendRequest(peerId, props.roomId),
    onPeerLeave: (peerId) => {
      pendingRequests.value = pendingRequests.value.filter((r) => r.fromPeerId !== peerId)
    },
    onRequest: (request, fromPeerId) => {
      pendingRequests.value = [...pendingRequests.value, { request, fromPeerId }]
    },
    onAccepted: () => {
      /* peer is coming to our room — keep searching */
    },
    onIgnored: () => {},
    onPeerName: (peerId, name) => {
      peerNames.value[peerId] = name
    }
  })

  handle.getPeerIds().forEach((peerId) => handle.sendRequest(peerId, props.roomId))
  handle.setName(props.playerName)
  lobbyHandle.value = handle
}

const acceptRequest = (entry: { request: MatchRequest; fromPeerId: string }): void => {
  lobbyHandle.value?.acceptRequest(entry.request, entry.fromPeerId)
  lobbyHandle.value?.stop()
  lobbyHandle.value = null
  router.push(`?room=${entry.request.gameRoomId}`)
}

onUnmounted(() => {
  lobbyHandle.value?.stop()
  lobbyHandle.value = null
})
```

---

## vite.config.ts

Trystero must be excluded from Vite's pre-bundling — it calls `crypto.subtle` at module initialization, which fails in Node during the optimizer phase:

```typescript
// vite.config.ts
export default defineConfig({
  optimizeDeps: {
    exclude: ['trystero', 'trystero/nostr']
  }
})
```

## Types

```typescript
interface P2PSession {
  peerId: string // Local peer ID assigned by Trystero
  room: Room // Underlying Trystero Room
  destroy: () => void
}

interface P2PConfig {
  appId?: string // Default: 'webgamekit'
  throttleMs?: number // Position broadcast throttle, default: 30 ms
}

type MatchmakeStatus = 'searching' | 'matched'

interface MatchmakeHandle {
  session: P2PSession
  stop: () => void
}

interface MatchRequest {
  requestId: string
  gameRoomId: string
}

interface LobbyHandle {
  session: P2PSession
  getPeerIds: () => string[]
  setName: (name: string) => void
  sendRequest: (targetPeerId: string, gameRoomId?: string) => MatchRequest
  acceptRequest: (request: MatchRequest, fromPeerId: string) => void
  ignoreRequest: (request: MatchRequest, fromPeerId: string) => void
  stop: () => void
}
```
