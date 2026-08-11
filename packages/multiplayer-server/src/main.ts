import { multiplayerServerCreate } from './server'

const DEFAULT_PORT = 3000
const port = Number(process.env.PORT ?? DEFAULT_PORT)

const { httpServer, cleanup } = multiplayerServerCreate()

httpServer.listen(port, () => {
  process.stdout.write(`multiplayer-server listening on port ${port}\n`)
})

// Containers stop with SIGTERM; close the sockets so players see a clean disconnect.
const shutdown = () => {
  cleanup()
  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
