import type * as THREE from 'three'
import type { Ref } from 'vue'
import type { computed } from 'vue'
import type { TimelineManager } from '@webgamekit/animation'
import type { P2PSession } from '@webgamekit/multiplayer-p2p'
import type { useBubbleShooterStore } from '@/stores/bubbleShooter'
import type { BubbleColor, BsColorCount, BsSpeed } from './config'

// ---- Grid ----

export type GridCell = { color: BubbleColor | null }
export type Grid = GridCell[][]
export type Coord = [number, number]

export type TrajectoryConfig = {
  wallLeft: number
  wallRight: number
  ceilingY: number
  maxReflections?: number
  stepSize?: number
  maxSteps?: number
}

// ---- Session ----

export type HelloPayload = { name: string; color: string }
export type AvatarPayload = { name: string; color: string }
export type StartPayload = { seed: number }
export type GarbagePayload = { count: number }
export type ScorePayload = { playerId: string; score: number }
export type GameOverPayload = { loserId: string }

export type UseBubbleShooterSessionOptions = {
  name: string
  color: string
  roomId: string
}

export type BsContext = {
  options: UseBubbleShooterSessionOptions
  store: ReturnType<typeof useBubbleShooterStore>
  session: Ref<P2PSession | null>
  localPeerId: Ref<string>
  isHost: ReturnType<typeof computed<boolean>>
  onGarbage: (count: number) => void
}

// ---- Game ----

export type ScorePopup = {
  points: number
  comboPoints: number
  xPercent: number
  yPercent: number
}

export type ScorePopupItem = ScorePopup & { id: number }

export type GameDeps = {
  canvas: Ref<HTMLCanvasElement | null>
  isSolo: Ref<boolean>
  colorCount: Ref<BsColorCount>
  speed: Ref<BsSpeed>
  onScore: (popup: ScorePopup) => void
  onGarbageSent: (count: number) => void
  onGameOver: () => void
}

export type PopParticle = {
  mesh: THREE.Mesh
  vx: number
  vy: number
  life: number
}

export type BsGameContext = {
  grid: Grid
  aimAngle: number
  isFlying: boolean
  inFlightDx: number
  inFlightDy: number
  rowDropAccumulator: number
  dropAnimActive: boolean
  dropAnimElapsed: number
  dropAnimOffset: number
  scene: THREE.Scene | null
  camera: THREE.PerspectiveCamera | null
  shooterGroup: THREE.Group | null
  trajectoryDots: THREE.Mesh[]
  trajectoryPoints: { x: number; y: number }[]
  trajectoryCumulative: number[]
  trajectoryTotalLength: number
  trajectoryPhase: number
  loadedMesh: THREE.Mesh | null
  nextMesh: THREE.Mesh | null
  inFlightMesh: THREE.Mesh | null
  rollMesh: THREE.Mesh | null
  rollPhase: 'idle' | 'waiting' | 'docking'
  rollActionId: string | null
  rollTimeline: TimelineManager
  frame: number
  bubbleGeo: THREE.SphereGeometry
  bubbleMeshes: Map<string, THREE.Mesh>
  gravityVelocities: Map<string, { vx: number; vy: number }>
  materials: Partial<Record<BubbleColor, THREE.MeshStandardMaterial>>
  popParticles: PopParticle[]
  score: Ref<number>
  shotCount: Ref<number>
  currentColor: Ref<BubbleColor>
  nextColor: Ref<BubbleColor>
  isGameOver: Ref<boolean>
  pendingGarbage: Ref<number>
  gamepadFirePressed: boolean
  gamepadAimHoldMs: number
  gamepadInputInitialized: boolean
  onGameOverInternal: () => void
  deps: GameDeps
}
