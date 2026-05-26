import type { Ref, ComputedRef } from 'vue'
import type { TrackConfig } from './config'
import type { P2PSession } from '@webgamekit/multiplayer-p2p'
import type { useMarbleMadnessStore } from '@/stores/marbleMadness'

export type HelloPayload = { name: string; color: string }
export type AvatarPayload = { name: string; color: string }
export type StartPayload = { timestamp: number }
export type BallPosPayload = { x: number; y: number; z: number }
export type FinishPayload = { playerId: string; time: number }

export type UseMarbleMadnessSessionOptions = {
  name: string
  color: string
  roomId: string
}

export type MmContext = {
  options: UseMarbleMadnessSessionOptions
  store: ReturnType<typeof useMarbleMadnessStore>
  session: Ref<P2PSession | null>
  localPeerId: Ref<string>
  isHost: ComputedRef<boolean>
  onBallPos: (peerId: string, pos: BallPosPayload) => void
}

export type GameDeps = {
  canvas: Ref<HTMLCanvasElement | null>
  isSolo: Ref<boolean>
  track: Ref<TrackConfig>
  onWin: () => void
  onPositionUpdate: (pos: BallPosPayload) => void
}
