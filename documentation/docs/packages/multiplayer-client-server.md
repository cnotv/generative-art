---
sidebar_position: 10
---

# Packages: @webgamekit/multiplayer-client and @webgamekit/multiplayer-server

Client/server multiplayer over [Socket.IO](https://socket.io/). The two packages are the
two halves of one protocol, so they are documented together: `multiplayer-client` runs in
the browser, `multiplayer-server` runs on Node.js and owns the authoritative player
registry.

Use this pair when you want a server that holds shared state. When no server is available,
use [`@webgamekit/multiplayer-p2p`](./multiplayer-p2p.md) instead — the two are independent
strategies and neither depends on the other.

## Installation

```bash
pnpm add @webgamekit/multiplayer-client socket.io-client   # browser
pnpm add @webgamekit/multiplayer-server                    # Node.js
```

The server package depends on `socket.io` directly, so there is nothing else to install —
it creates the Socket.IO server itself. On the client, `socket.io-client` stays a peer
dependency so the host application controls the version that ends up in its bundle.

## Core concepts

| Concept      | Description                                                                                         |
| ------------ | --------------------------------------------------------------------------------------------------- |
| **Session**  | The handle returned by `multiplayerClientCreate()`. Carries the Socket.IO `socket` and `destroy()`. |
| **Registry** | The server's map of connected players, keyed by socket id. Rebuilt immutably on every change.       |
| **Channel**  | A named Socket.IO event carrying an arbitrary serializable payload, e.g. `"coin:collected"`.        |

## Wire protocol

Both packages agree on two reserved event names. Everything else is application-defined and
travels through the generic data channels.

| Event          | Direction       | Payload                             |
| -------------- | --------------- | ----------------------------------- |
| `user:updated` | client → server | `{ position, rotation, name? }`     |
| `user:list`    | server → client | `PlayerState[]` — the full registry |

The server broadcasts the whole registry rather than deltas. That is the cheapest thing that
is always correct, and it keeps a late-joining client from needing a separate catch-up path.

## Quick start — client

```typescript
import {
  multiplayerClientCreate,
  multiplayerClientDestroy,
  multiplayerClientSendPosition,
  multiplayerClientOnPlayers
} from '@webgamekit/multiplayer-client'

const session = multiplayerClientCreate('http://localhost:3000')

const unsubscribe = multiplayerClientOnPlayers(session, (players) => {
  renderPlayers(players)
})

// Safe to call every frame — see "Position throttling" below.
multiplayerClientSendPosition(session, { x: 1, y: 0, z: 3 }, { x: 0, y: 1.57, z: 0 })

unsubscribe()
multiplayerClientDestroy(session)
```

## Quick start — server

`multiplayerServerCreate` builds the Socket.IO server and the HTTP server it rides on, and
hands both back. Choosing the port is the only thing left to the caller.

```typescript
import { multiplayerServerCreate } from '@webgamekit/multiplayer-server'

const { server, httpServer, cleanup } = multiplayerServerCreate({
  onConnect: (socketId) => ({ 'coin:list': currentCoins(socketId) })
})

httpServer.listen(3000)
```

`onConnect` returns a map of channel to payload that is emitted to the joining socket alone.
It is the hook for handing a new player the world state they missed. `cors` defaults to
`{ origin: '*' }`; pass your own to lock the server to known origins.

### Attaching to a server you already own

When the application already has an HTTP server — an Express or Fastify app — use
`multiplayerServerAttach` instead and keep ownership of the lifecycle:

```typescript
import { multiplayerServerAttach } from '@webgamekit/multiplayer-server'

const { cleanup } = multiplayerServerAttach(existingIo)
```

## Running the server

The package ships a ready entrypoint that reads `PORT` (default `3000`) and shuts down
cleanly on `SIGTERM`, so it can be run directly or as a container:

```bash
pnpm --filter @webgamekit/multiplayer-server build
PORT=3000 pnpm --filter @webgamekit/multiplayer-server start
```

`Dockerfile.server` at the repo root builds an image containing only this package and its
dependencies — the frontend toolchain is excluded. CI publishes it on every push to `main`:

```bash
docker run -p 3000:3000 ghcr.io/cnotv/generative-art-multiplayer-server:latest
```

The deployment `docker-compose.yml` runs it as the `multiplayer-server` service on port
3001, alongside the website on 3000.

## Position throttling

`multiplayerClientSendPosition` throttles on the **leading edge**: the first call in a
window emits immediately, and further calls are dropped until the window elapses.

This matters because the function's normal caller is a render loop running at roughly 16 ms
per frame while the default window is 30 ms. A trailing-edge implementation — one that
defers the emission and restarts its timer on every call — would have its timer cleared by
the next frame before it ever fired, so a continuously moving player would broadcast
nothing at all. Leading-edge throttling degrades in the safe direction: worst case the
receiver sees a position up to one window stale, and it never sees silence.

Override the window per session:

```typescript
const session = multiplayerClientCreate(url, { throttleMs: 100 })
```

## Generic data channels

Anything that is not position travels through the typed channel helpers, which are a thin
typed wrapper over `socket.emit` and `socket.on`.

```typescript
import { multiplayerClientSendData, multiplayerClientOnData } from '@webgamekit/multiplayer-client'

multiplayerClientSendData(session, 'coin:collected', { coinId: 'c1' })

const stop = multiplayerClientOnData<{ coinId: string }>(session, 'coin:collected', (payload) => {
  removeCoin(payload.coinId)
})
```

The generic parameter is a compile-time claim, not a runtime check — the server can send
anything. Validate a payload before trusting it if it crosses a trust boundary.

## API

### Client

| Function                                              | Returns      | Description                                         |
| ----------------------------------------------------- | ------------ | --------------------------------------------------- |
| `multiplayerClientCreate(url, config?)`               | `Session`    | Connects to a Socket.IO server                      |
| `multiplayerClientDestroy(session)`                   | `void`       | Disconnects the socket                              |
| `multiplayerClientSendPosition(session, pos, rot)`    | `void`       | Broadcasts local transform, leading-edge throttled  |
| `multiplayerClientOnPlayers(session, callback)`       | `() => void` | Subscribes to registry updates; returns unsubscribe |
| `multiplayerClientSendData(session, channel, data)`   | `void`       | Sends on an application channel                     |
| `multiplayerClientOnData(session, channel, callback)` | `() => void` | Subscribes to a channel; returns unsubscribe        |

### Server

| Function                               | Returns                           | Description                                     |
| -------------------------------------- | --------------------------------- | ----------------------------------------------- |
| `multiplayerServerCreate(config?)`     | `{ server, httpServer, cleanup }` | Creates both servers with handling attached     |
| `multiplayerServerAttach(io, config?)` | `{ cleanup }`                     | Attaches handling to a Socket.IO server you own |

`cleanup()` removes the connection listener and empties the registry; the one returned by
`multiplayerServerCreate` also closes both servers.

## Types

```typescript
interface PlayerPosition {
  x: number
  y: number
  z: number
}

interface PlayerRotation {
  x: number
  y: number
  z: number
}

interface PlayerState {
  id: string
  name: string
  position: PlayerPosition
  rotation: PlayerRotation
}

interface MultiplayerClientConfig {
  throttleMs?: number // Position broadcast window, default: 30 ms
}

interface MultiplayerClientSession {
  socket: Socket // the socket.io-client Socket
  destroy: () => void
}

interface MultiplayerServerConfig {
  onConnect?: (socketId: string) => Record<string, unknown>
  cors?: ServerOptions['cors'] // default: { origin: '*' }
}

interface MultiplayerServerHandle {
  server: Server // the socket.io Server
  httpServer: HttpServer // the node:http Server — call listen() on this
  cleanup: () => void
}
```

## Demo

`/experiments/MultiplayerClient` connects to a server URL, lists connected players, and
broadcasts a random position on demand. It needs a Socket.IO server running separately —
the app itself is a static build and ships no server.
