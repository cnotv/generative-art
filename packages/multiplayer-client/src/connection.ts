import { io } from 'socket.io-client'
import type { MultiplayerClientConfig, MultiplayerClientSession } from './types'

/**
 * Connect to a Socket.IO multiplayer server.
 * @param url - WebSocket server URL (e.g. "http://localhost:3000")
 * @param config - Optional configuration overrides
 * @returns A MultiplayerClientSession with the socket and a destroy function
 */
export const multiplayerClientCreate = (
  url: string,
  config?: MultiplayerClientConfig
): MultiplayerClientSession & { _config: Required<MultiplayerClientConfig> } => {
  const socket = io(url)
  const resolvedConfig: Required<MultiplayerClientConfig> = {
    throttleMs: config?.throttleMs ?? 30
  }

  const destroy = () => {
    socket.disconnect()
  }

  return { socket, destroy, _config: resolvedConfig }
}

/**
 * Disconnect and clean up a multiplayer client session.
 * @param session - The session returned by multiplayerClientCreate
 */
export const multiplayerClientDestroy = (session: MultiplayerClientSession): void => {
  session.destroy()
}
