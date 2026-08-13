import { multiplayerServerCreate } from '@webgamekit/multiplayer-server'

const DEFAULT_PORT = 3000
const COIN_COUNT = 12
const ARENA_RADIUS = 20

interface Coin {
  id: string
  x: number
  z: number
}

const randomCoordinate = (): number => Number(((Math.random() * 2 - 1) * ARENA_RADIUS).toFixed(2))

const createCoins = (): Coin[] =>
  Array.from({ length: COIN_COUNT }, (_unused, index) => ({
    id: `coin-${index}`,
    x: randomCoordinate(),
    z: randomCoordinate()
  }))

/**
 * The coins are state the server owns, rather than something each client decides for
 * itself — two players reaching the same coin must not both score it. Keeping it in a
 * closure means nothing outside these handlers can reach in and change it.
 */
const createCoinArena = () => {
  let coins = createCoins()

  return {
    list: (): Coin[] => coins,
    claim: (coinId: string): { taken: boolean; refilled: boolean } => {
      const remaining = coins.filter((coin) => coin.id !== coinId)
      if (remaining.length === coins.length) return { taken: false, refilled: false }

      coins = remaining
      const refilled = coins.length === 0
      if (refilled) coins = createCoins()

      return { taken: true, refilled }
    }
  }
}

const arena = createCoinArena()
const port = Number(process.env.PORT ?? DEFAULT_PORT)

const { server, httpServer, cleanup } = multiplayerServerCreate({
  // Emitted to the joining socket alone: how a late player catches up on state that was
  // decided before they arrived. Position and the player list are handled by the package.
  onConnect: () => ({ 'coin:list': arena.list() })
})

// Anything beyond position lives on your own channels. The package never inspects them.
server.on('connection', (socket) => {
  socket.on('coin:collected', (coinId: string) => {
    const { taken, refilled } = arena.claim(coinId)
    // A second claim on an already-taken coin is normal with lag, not an error: the loser
    // simply hears nothing back and keeps the coin hidden from the coin:taken they saw.
    if (!taken) return

    server.emit('coin:taken', { coinId, by: socket.id })
    if (refilled) server.emit('coin:list', arena.list())
  })
})

httpServer.listen(port, () => {
  process.stdout.write(`example multiplayer server listening on port ${port}\n`)
})

const shutdown = () => {
  cleanup()
  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
