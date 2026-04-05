import type { Room, DataPayload } from 'trystero/nostr'

export type { DataPayload }

export interface P2PConfig {
  /** App identifier — must be unique to your game (default: "webgamekit") */
  appId?: string
  /** Minimum ms between position broadcasts (default: 30) */
  throttleMs?: number
}

export interface P2PSession {
  /** Local peer ID assigned by Trystero */
  peerId: string
  /** The underlying Trystero Room */
  room: Room
  /** Leave the room and clean up */
  destroy: () => void
}

/** Serializable position — compatible with Trystero DataPayload */
export type PlayerPosition = { x: number; y: number; z: number } & Record<string, number>

/** Serializable rotation — compatible with Trystero DataPayload */
export type PlayerRotation = { x: number; y: number; z: number } & Record<string, number>

export interface PlayerState {
  id: string
  position: PlayerPosition
  rotation: PlayerRotation
}

/** Serializable animation action — compatible with Trystero DataPayload */
export type PlayerAction = { name: string } & Record<string, string>
