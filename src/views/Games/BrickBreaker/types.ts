import type { Ref } from 'vue'
import type { MatchStartPayload } from '@/types/seededMatch'

export type BrickKind = 'normal' | 'tough' | 'garbage'

export type Brick = {
  id: string
  row: number
  column: number
  hitPoints: number
  kind: BrickKind
  colorIndex: number
}

export type BrickBounds = {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export type BallState = {
  x: number
  y: number
  velocityX: number
  velocityY: number
}

export type PaddleState = {
  x: number
  width: number
}

export type BallStepResult = {
  ball: BallState
  hitBrickIds: string[]
  hitPaddle: boolean
  isLost: boolean
}

export type BrickHitResult = {
  bricks: Brick[]
  destroyedBricks: Brick[]
}

export type BbPhase = 'lobby' | 'playing' | 'summary'

export type BbMatchLength = 'endless' | 'sprint'

export type BbPlayer = {
  id: string
  name: string
  color: string
  score: number
}

export type BbGarbagePayload = { rows: number }
export type BbScorePayload = { score: number }
export type BbConfigPayload = { matchLength: BbMatchLength }

export type UseBrickBreakerSessionOptions = {
  name: string
  color: string
  roomId: string
}

export type BbSessionCallbacks = {
  onMatchStart: (payload: MatchStartPayload) => void
  onGarbage: (rows: number) => void
  onSurvivorFinish: () => void
}

export type BbScorePopup = {
  id: number
  points: number
  xPercent: number
  yPercent: number
}

export type BbGameDeps = {
  canvas: Ref<HTMLCanvasElement | null>
  isSolo: Ref<boolean>
  onScore: (score: number, popup: Omit<BbScorePopup, 'id'>) => void
  onGarbageSent: (rows: number) => void
  onEnd: (score: number, isEliminated: boolean) => void
}

export type BbRunState = {
  seed: number
  startAt: number
  durationMs: number | null
  bricks: Brick[]
  ball: BallState | null
  paddle: PaddleState
  serveSeconds: number
  level: number
  destroyedCount: number
  garbageGeneration: number
  pendingGarbageRows: number
  elapsedMs: number
  isRunning: boolean
}
