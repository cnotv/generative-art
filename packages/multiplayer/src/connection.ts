import { io } from 'socket.io-client'
import type { MultiplayerConfig, MultiplayerSession } from './types'

/**
 * Connect to a Socket.IO multiplayer server.
 * @param url - WebSocket server URL (e.g. "http://localhost:3000")
 * @param config - Optional configuration overrides
 * @returns A MultiplayerSession with the socket and a destroy function
 */
export const multiplayerCreate = (
  url: string,
  config?: MultiplayerConfig
): MultiplayerSession & { _config: Required<MultiplayerConfig> } => {
  const socket = io(url)
  const resolvedConfig: Required<MultiplayerConfig> = {
    throttleMs: config?.throttleMs ?? 30
  }

  const destroy = () => {
    socket.disconnect()
  }

  return { socket, destroy, _config: resolvedConfig }
}

/**
 * Disconnect and clean up a multiplayer session.
 * @param session - The session returned by multiplayerCreate
 */
export const multiplayerDestroy = (session: MultiplayerSession): void => {
  session.destroy()
}
