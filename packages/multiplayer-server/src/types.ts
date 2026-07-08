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

export interface MultiplayerServerConfig {
  /** Called when a player connects, returns initial data to send them */
  onConnect?: (socketId: string) => Record<string, unknown>
}
