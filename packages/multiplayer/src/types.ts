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

export interface CoinState {
  id: string
  position: PlayerPosition
  collected: boolean
}

export interface CoinCollectedEvent {
  coinId: string
  playerId: string
}

export interface MultiplayerConfig {
  /** Minimum ms between position broadcasts (default: 30) */
  throttleMs?: number
}

export interface MultiplayerSession {
  /** The underlying socket instance */
  socket: import('socket.io-client').Socket
  /** Cancel any pending position broadcast and disconnect */
  destroy: () => void
}
