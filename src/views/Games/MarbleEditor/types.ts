import type { CoordinateTuple, ComplexModel } from '@webgamekit/animation'

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

export type BoostZone = {
  position: CoordinateTuple
  yaw: number
  length: number
  width: number
}

export type BuiltTrack = {
  models: ComplexModel[]
  transforms: PieceTransform[]
  startTransform: PieceTransform | null
  finishTransform: PieceTransform | null
  boostZones: BoostZone[]
  dispose: () => void
}
