import type { Server, Socket } from 'socket.io'
import type { PlayerState, PlayerRotation, PlayerPosition, MultiplayerServerConfig } from './types'

type PositionPayload = { position: PlayerPosition; rotation: PlayerRotation; name?: string }
type PlayerRegistry = Readonly<Record<string, PlayerState>>

const broadcastPlayerList = (io: Server, players: PlayerRegistry): void => {
  io.emit('user:list', Object.values(players))
}

const registerPlayerHandlers = (
  socket: Socket,
  io: Server,
  getPlayers: () => PlayerRegistry,
  setPlayers: (p: PlayerRegistry) => void,
  config: MultiplayerServerConfig
): void => {
  const initialState: PlayerState = {
    id: socket.id,
    name: socket.id,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 }
  }
  setPlayers({ ...getPlayers(), [socket.id]: initialState })

  if (config.onConnect) {
    const initialData = config.onConnect(socket.id)
    Object.entries(initialData).forEach(([channel, payload]) => {
      socket.emit(channel, payload)
    })
  }

  broadcastPlayerList(io, getPlayers())

  socket.on('user:updated', (payload: PositionPayload) => {
    const current = getPlayers()[socket.id] ?? initialState
    setPlayers({
      ...getPlayers(),
      [socket.id]: {
        ...current,
        name: payload.name ?? current.name,
        position: payload.position,
        rotation: payload.rotation
      }
    })
    io.emit('user:list', Object.values(getPlayers()))
  })

  socket.on('disconnect', () => {
    const { [socket.id]: _removed, ...rest } = getPlayers()
    setPlayers(rest)
    broadcastPlayerList(io, getPlayers())
  })
}

/**
 * Attach multiplayer session handling to a Socket.IO server instance.
 * Manages player registry, position relay, and generic data forwarding.
 * @param io - A Socket.IO Server instance
 * @param config - Optional server configuration
 * @returns cleanup function that removes the connection listener
 */
export const multiplayerServerCreate = (
  io: Server,
  config: MultiplayerServerConfig = {}
): { cleanup: () => void } => {
  let players: PlayerRegistry = {}

  const getPlayers = () => players
  const setPlayers = (p: PlayerRegistry) => {
    players = p
  }

  const onConnection = (socket: Socket) => {
    registerPlayerHandlers(socket, io, getPlayers, setPlayers, config)
  }

  io.on('connection', onConnection)

  return {
    cleanup: () => {
      io.off('connection', onConnection)
      players = {}
    }
  }
}
