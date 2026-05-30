import type { Ref, ComputedRef } from 'vue'
import type { TrackConfig } from './config'
import type { P2PSession } from '@webgamekit/multiplayer-p2p'
import type { useMarbleMadnessStore } from '@/stores/marbleMadness'

export type HelloPayload = { name: string; color: string; marble: string }
export type AvatarPayload = { name: string; color: string; marble: string }
export type StartPayload = { timestamp: number; trackIndex: number }
export type BallPosPayload = {
  x: number
  y: number
  z: number
  rx: number
  ry: number
  rz: number
  rw: number
}
export type FinishPayload = { playerId: string; time: number }

export type UseMarbleMadnessSessionOptions = {
  name: string
  color: string
  marble: string
  roomId: string
}

export type MmContext = {
  options: UseMarbleMadnessSessionOptions
  store: ReturnType<typeof useMarbleMadnessStore>
  session: Ref<P2PSession | null>
  localPeerId: Ref<string>
  isHost: ComputedRef<boolean>
  onBallPos: (peerId: string, pos: BallPosPayload) => void
  onStart: (trackIndex: number) => void
}

export type GameMode = 'race' | 'rush'

export type GameDeps = {
  canvas: Ref<HTMLCanvasElement | null>
  isSolo: Ref<boolean>
  track: Ref<TrackConfig>
  marble: Ref<string>
  onWin: () => void
  onPositionUpdate: (pos: BallPosPayload) => void
}
