import type { PlayerPosition, PlayerRotation, PlayerState, MultiplayerClientSession } from './types'
import { DEFAULT_THROTTLE_MS } from './connection'

type InternalSession = MultiplayerClientSession & { _config: { throttleMs: number } }

const lastSentAt = new WeakMap<MultiplayerClientSession, number>()

/**
 * Broadcast the local player's position and rotation to the server, throttled.
 * The first call of a window emits immediately; further calls are dropped until the
 * window elapses, so a per-frame caller keeps sending instead of starving.
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
  const throttleMs = internal._config?.throttleMs ?? DEFAULT_THROTTLE_MS
  const now = Date.now()
  const previous = lastSentAt.get(session)
  if (previous !== undefined && now - previous < throttleMs) return

  lastSentAt.set(session, now)
  session.socket.emit('user:updated', { position, rotation })
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
