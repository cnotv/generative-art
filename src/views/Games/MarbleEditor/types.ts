import type { Group, Mesh } from 'three'
import type { CoordinateTuple } from '@webgamekit/animation'

export type TrackPieceType =
  | 'start'
  | 'finish'
  | 'straight-short'
  | 'straight-long'
  | 'curve-left'
  | 'curve-right'
  | 'banked-left'
  | 'banked-right'
  | 'ramp-up'
  | 'ramp-down'
  | 'funnel'
  | 'loop'
  | 'gap-jump'
  | 'boost-pad'
  | 'bumper-field'

export type PlacedPiece = {
  id: string
  type: TrackPieceType
  color: number
}

export type MarbleMap = {
  version: 1
  name: string
  pieces: PlacedPiece[]
  updatedAt: number
}

export type PieceTransform = {
  position: CoordinateTuple
  yaw: number
}

export type PieceSpec = {
  type: TrackPieceType
  label: string
  defaultColor: number
  exitOffset: CoordinateTuple
  exitYawDelta: number
}

export type CameraMode = 'first' | 'third' | 'free'

export type MarblePhysics = {
  weight: number
  restitution: number
  friction: number
  linearDamping: number
  angularDamping: number
  size: number
}

export type SpawnTestBallsOptions = {
  count: number
  ballType: string
  randomType: boolean
  randomTextures: boolean
}

export type MePlayer = {
  id: string
  name: string
  color: string
  marble: string
  finishTime: number | null
}

export type MePhase = 'lobby' | 'edit' | 'race' | 'summary'

export type BallPosPayload = {
  x: number
  y: number
  z: number
  rx: number
  ry: number
  rz: number
  rw: number
}

export type MeAvatarPayload = {
  name: string
  color: string
  marble: string
}

export type MeMapPayload = {
  map: MarbleMap
}

export type MeStartPayload = {
  timestamp: number
  map: MarbleMap
}

export type MeFinishPayload = {
  playerId: string
  time: number
}

export type MeRestartPayload = {
  timestamp: number
}

export type UseMarbleEditorSessionOptions = {
  name: string
  color: string
  marble: string
  roomId: string
}

export type MeSessionCallbacks = {
  onMapReceived: (map: MarbleMap) => void
  onBallPos: (peerId: string, pos: BallPosPayload) => void
  getCurrentMap: () => MarbleMap
}

export type BoostZone = {
  position: CoordinateTuple
  yaw: number
  length: number
  width: number
}

export type TrackColliderSpec = {
  triangles: number[]
  friction: number
  restitution: number
}

export type BuiltTrack = {
  models: Mesh[]
  transforms: PieceTransform[]
  startTransform: PieceTransform | null
  finishTransform: PieceTransform | null
  boostZones: BoostZone[]
  dispose: () => void
}

export type TrackBounds = {
  min: CoordinateTuple
  max: CoordinateTuple
}

export type RoomLayout = {
  centerX: number
  centerZ: number
  width: number
  depth: number
  floorY: number
  wallHeight: number
}

export type ToyKind =
  | 'teddy-bear'
  | 'letter-block'
  | 'beach-ball'
  | 'book-stack'
  | 'crayon'
  | 'toy-train'

export type ToySpot = {
  kind: ToyKind
  fraction: number
  inset: number
  scale: number
  rotationY: number
  variant: number
}

export type ToyPlacement = {
  kind: ToyKind
  position: CoordinateTuple
  rotationY: number
  scale: number
  variant: number
}

export type BedroomEnvironment = {
  layout: RoomLayout
  group: Group
  dispose: () => void
}
