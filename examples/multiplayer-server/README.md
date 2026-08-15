# Example: multiplayer server

A small game server built on `@webgamekit/multiplayer-server`, showing the part the package
deliberately leaves to you: **your own game state, on your own channels**.

The package already handles the player registry — who is connected, where they are, and
broadcasting that to everyone. This example adds a coin arena on top of it.

## Run it

```bash
pnpm --filter @webgamekit/example-multiplayer-server start
```

It listens on `PORT` (default 3000), so the demo view at `/experiments/MultiplayerClient`
connects to it without changing the URL field.

## What it demonstrates

| Concern                   | How                                                                        |
| ------------------------- | -------------------------------------------------------------------------- |
| Catching a late player up | `onConnect` returns `{ 'coin:list': [...] }`, emitted to that socket alone |
| Application channels      | `coin:collected` in, `coin:taken` and `coin:list` out                      |
| Server-owned state        | the coin list lives in a closure, so only the handlers can change it       |
| Clean shutdown            | `SIGTERM` and `SIGINT` run `cleanup()`                                     |

## Why the server owns the coins

Two players can reach the same coin within one network round trip. If each client decided
for itself, both would score it and the two clients would disagree about the world from then
on. The server resolving the claim is what makes the outcome single-valued.

The losing claim is answered with silence rather than an error, because a second claim on an
already-taken coin is the _normal_ result of lag, not a fault. The loser has already seen the
`coin:taken` broadcast and removed the coin.

## Wire protocol

Reserved by the package:

| Event          | Direction       | Payload                             |
| -------------- | --------------- | ----------------------------------- |
| `user:updated` | client → server | `{ position, rotation, name? }`     |
| `user:list`    | server → client | `PlayerState[]` — the full registry |

Added by this example:

| Event            | Direction       | Payload                    |
| ---------------- | --------------- | -------------------------- |
| `coin:list`      | server → client | `Coin[]` — full coin state |
| `coin:collected` | client → server | `coinId`                   |
| `coin:taken`     | server → client | `{ coinId, by }`           |

## Trying it by hand

With the server running, from a Node REPL or a scratch file:

```js
import { io } from 'socket.io-client'

const socket = io('http://localhost:3000')
socket.on('coin:list', (coins) => socket.emit('coin:collected', coins[0].id))
socket.on('coin:taken', console.log) // { coinId: 'coin-0', by: '<socket id>' }
```

See [the package documentation](../../documentation/docs/packages/multiplayer-client-server.md)
for the full API, and
[the deployment guide](../../documentation/docs/guides/deploying-the-multiplayer-server.md)
for running a server in production.
