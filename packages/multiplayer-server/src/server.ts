import type { Server, Socket } from 'socket.io'
import type { PlayerState, PlayerRotation, PlayerPosition, MultiplayerServerConfig } from './types'

type PositionPayload = { position: PlayerPosition; rotation: PlayerRotation; name?: string }

const broadcastPlayerList = (io: Server, players: Map<string, PlayerState>): void => {
  io.emit('user:list', [...players.values()])
}

const registerPlayerHandlers = (
  socket: Socket,
  io: Server,
  players: Map<string, PlayerState>,
  config: MultiplayerServerConfig
): void => {
  const initialState: PlayerState = {
    id: socket.id,
    name: socket.id,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 }
  }
  players.set(socket.id, initialState)

  if (config.onConnect) {
    const initialData = config.onConnect(socket.id)
    Object.entries(initialData).forEach(([channel, payload]) => {
      socket.emit(channel, payload)
    })
  }

  broadcastPlayerList(io, players)

  socket.on('user:updated', (payload: PositionPayload) => {
    const current = players.get(socket.id) ?? initialState
    players.set(socket.id, {
      ...current,
      name: payload.name ?? current.name,
      position: payload.position,
      rotation: payload.rotation
    })
    io.emit('user:list', [...players.values()])
  })

  socket.on('disconnect', () => {
    players.delete(socket.id)
    broadcastPlayerList(io, players)
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
  const players = new Map<string, PlayerState>()

  const onConnection = (socket: Socket) => {
    registerPlayerHandlers(socket, io, players, config)
  }

  io.on('connection', onConnection)

  return {
    cleanup: () => {
      io.off('connection', onConnection)
      players.clear()
    }
  }
}
