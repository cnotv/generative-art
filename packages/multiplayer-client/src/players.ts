import type { PlayerPosition, PlayerRotation, PlayerState, MultiplayerClientSession } from './types'

type InternalSession = MultiplayerClientSession & { _config: { throttleMs: number } }

const pendingTimers = new WeakMap<MultiplayerClientSession, ReturnType<typeof setTimeout>>()

/**
 * Broadcast the local player's position and rotation to the server, throttled.
 * Only one emission is sent per throttle window — always the most recent values.
 * @param session - The active multiplayer client session
 * @param position - Current player position {x, y, z}
 * @param rotation - Current player rotation {x, y, z}
 */
export const multiplayerClientSendPosition = (
  session: MultiplayerClientSession,
  position: PlayerPosition,
  rotation: PlayerRotation
): void => {
  const internal = session as InternalSession
  const defaultThrottleMs = 30
  const throttleMs = internal._config?.throttleMs ?? defaultThrottleMs
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
 * @param session - The active multiplayer client session
 * @param callback - Called with the full list of connected players on each update
 * @returns Unsubscribe function
 */
export const multiplayerClientOnPlayers = (
  session: MultiplayerClientSession,
  callback: (players: PlayerState[]) => void
): (() => void) => {
  session.socket.on('user:list', callback)
  return () => session.socket.off('user:list', callback)
}
