import type * as THREE from 'three'
import type { Ref } from 'vue'
import type { computed } from 'vue'
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

export type GameDeps = {
  canvas: Ref<HTMLCanvasElement | null>
  isSolo: Ref<boolean>
  colorCount: Ref<BsColorCount>
  speed: Ref<BsSpeed>
  onScore: (points: number) => void
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
  scene: THREE.Scene | null
  camera: THREE.PerspectiveCamera | null
  shooterGroup: THREE.Group | null
  trajectoryLine: THREE.Line | null
  loadedMesh: THREE.Mesh | null
  nextMesh: THREE.Mesh | null
  inFlightMesh: THREE.Mesh | null
  bubbleGeo: THREE.SphereGeometry
  bubbleMeshes: Map<string, THREE.Mesh>
  materials: Partial<Record<BubbleColor, THREE.MeshStandardMaterial>>
  popParticles: PopParticle[]
  score: Ref<number>
  shotCount: Ref<number>
  currentColor: Ref<BubbleColor>
  nextColor: Ref<BubbleColor>
  isGameOver: Ref<boolean>
  pendingGarbage: Ref<number>
  deps: GameDeps
}
