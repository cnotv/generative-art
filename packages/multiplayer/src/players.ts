import type { PlayerPosition, PlayerRotation, PlayerState, MultiplayerSession } from './types'

type InternalSession = MultiplayerSession & { _config: { throttleMs: number } }

const pendingTimers = new WeakMap<MultiplayerSession, ReturnType<typeof setTimeout>>()

/**
 * Broadcast the local player's position and rotation to the server, throttled.
 * Only one emission is sent per throttle window regardless of how many times
 * this function is called — always using the most recent values.
 * @param session - The active multiplayer session
 * @param position - Current player position {x, y, z}
 * @param rotation - Current player rotation {x, y, z}
 */
export const multiplayerSendPosition = (
  session: MultiplayerSession,
  position: PlayerPosition,
  rotation: PlayerRotation
): void => {
  const internal = session as InternalSession
  const throttleMs = internal._config?.throttleMs ?? 30
  const existing = pendingTimers.get(session)
  if (existing !== undefined) clearTimeout(existing)

  pendingTimers.set(
    session,
    setTimeout(() => {
      pendingTimers.delete(session)
      session.socket.emit('user:updated', { position, rotation })
    }, throttleMs)
  )
}

/**
 * Subscribe to player list updates from the server.
 * @param session - The active multiplayer session
 * @param callback - Called with the full list of connected players on each update
 * @returns Unsubscribe function
 */
export const multiplayerOnPlayers = (
  session: MultiplayerSession,
  callback: (players: PlayerState[]) => void
): (() => void) => {
  session.socket.on('user:list', callback)
  return () => session.socket.off('user:list', callback)
}
