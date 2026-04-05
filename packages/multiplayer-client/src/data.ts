import type { MultiplayerClientSession } from './types'

/**
 * Send typed data to all connected players via a named channel.
 * @param session - The active multiplayer client session
 * @param channel - Event name identifying the data channel (e.g. "coin:collected")
 * @param payload - Serializable data to broadcast
 */
export const multiplayerClientSendData = <T>(
  session: MultiplayerClientSession,
  channel: string,
  payload: T
): void => {
  session.socket.emit(channel, payload)
}

/**
 * Subscribe to typed data arriving on a named channel from the server.
 * @param session - The active multiplayer client session
 * @param channel - Event name to listen on
 * @param callback - Called with the received payload
 * @returns Unsubscribe function
 */
export const multiplayerClientOnData = <T>(
  session: MultiplayerClientSession,
  channel: string,
  callback: (payload: T) => void
): (() => void) => {
  session.socket.on(channel, callback)
  return () => session.socket.off(channel, callback)
}
