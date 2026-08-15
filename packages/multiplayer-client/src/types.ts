export interface PlayerPosition {
  x: number
  y: number
  z: number
}

export interface PlayerRotation {
  x: number
  y: number
  z: number
}

export interface PlayerState {
  id: string
  name: string
  position: PlayerPosition
  rotation: PlayerRotation
}

export interface MultiplayerClientConfig {
  /** Minimum ms between position broadcasts (default: 30) */
  throttleMs?: number
}

export interface MultiplayerClientSession {
  /** The underlying socket.io Socket */
  socket: import('socket.io-client').Socket
  /** Disconnect and cancel pending broadcasts */
  destroy: () => void
}
