import * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import { getCube, getTrimesh } from '@webgamekit/threejs'
import type { ComplexModel, CoordinateTuple } from '@webgamekit/animation'
import type { PlacedPiece, PieceTransform, TrackPieceType } from './types'
import {
  LANE_WIDTH,
  DECK_THICKNESS,
  WALL_HEIGHT,
  WALL_THICKNESS,
  START_LENGTH,
  FINISH_LENGTH,
  STRAIGHT_SHORT_LENGTH,
  STRAIGHT_LONG_LENGTH,
  CURVE_RADIUS,
  CURVE_SEGMENTS,
  CURVE_CHORD_OVERLAP,
  BANK_ANGLE,
  RAMP_LENGTH,
  RAMP_ANGLE,
  FUNNEL_TONGUE_LENGTH,
  FUNNEL_RIM_RADIUS,
  FUNNEL_BOWL_DEPTH,
  FUNNEL_HOLE_RADIUS,
  FUNNEL_DROP_HEIGHT,
  FUNNEL_EXIT_LENGTH,
  LOOP_RADIUS,
  LOOP_BOTTOM_Z,
  LOOP_SEGMENTS,
  LOOP_GAP_ANGLE,
  LOOP_X_SHIFT,
  LOOP_LANE_WIDTH,
  LOOP_EXIT_LENGTH,
  GAP_RAMP_LENGTH,
  GAP_RAMP_ANGLE,
  GAP_LANDING_START,
  GAP_JUMP_LENGTH,
  GAP_JUMP_DROP,
  BOOST_PAD_LENGTH,
  BOOST_PAD_INSET,
  BUMPER_FIELD_LENGTH,
  BUMPER_SIZE_XZ,
  BUMPER_HEIGHT,
  BUMPER_RESTITUTION,
  DECK_FRICTION,
  DECK_RESTITUTION,
  COLOR_BOOST,
  COLOR_BUMPER
} from './config'

type BoxSpec = {
  size: CoordinateTuple
  center: THREE.Vector3
  quaternion: THREE.Quaternion
  color?: number
  friction?: number
  restitution?: number
}

type LatheSpec = {
  profile: THREE.Vector2[]
  center: THREE.Vector3
  friction: number
}

type PieceParts = {
  boxes: BoxSpec[]
  lathes: LatheSpec[]
}

const Y_AXIS = new THREE.Vector3(0, 1, 0)
const X_AXIS = new THREE.Vector3(1, 0, 0)
const Z_AXIS = new THREE.Vector3(0, 0, 1)
const IDENTITY_QUATERNION = new THREE.Quaternion()
const ZERO_VECTOR = new THREE.Vector3()

const vec = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z)
const yawQuaternion = (yaw: number): THREE.Quaternion =>
  new THREE.Quaternion().setFromAxisAngle(Y_AXIS, yaw)
const pitchQuaternion = (pitch: number): THREE.Quaternion =>
  new THREE.Quaternion().setFromAxisAngle(X_AXIS, pitch)
const rollQuaternion = (roll: number): THREE.Quaternion =>
  new THREE.Quaternion().setFromAxisAngle(Z_AXIS, roll)

const box = (
  size: CoordinateTuple,
  center: THREE.Vector3,
  extra: Partial<Omit<BoxSpec, 'size' | 'center'>> = {}
): BoxSpec => ({ size, center, quaternion: extra.quaternion ?? IDENTITY_QUATERNION, ...extra })

const transformSpec = (
  spec: BoxSpec,
  quaternion: THREE.Quaternion,
  translation: THREE.Vector3
): BoxSpec => ({
  ...spec,
  center: spec.center.clone().applyQuaternion(quaternion).add(translation),
  quaternion: quaternion.clone().multiply(spec.quaternion)
})

const transformSpecs = (
  specs: BoxSpec[],
  quaternion: THREE.Quaternion,
  translation: THREE.Vector3
): BoxSpec[] => specs.map((spec) => transformSpec(spec, quaternion, translation))

const WALL_CENTER_Y = (WALL_HEIGHT - DECK_THICKNESS) / 2
const WALL_FULL_HEIGHT = WALL_HEIGHT + DECK_THICKNESS

const laneDeckSpec = (length: number, width: number = LANE_WIDTH): BoxSpec =>
  box([width, DECK_THICKNESS, length], vec(0, -DECK_THICKNESS / 2, 0))

const laneWallSpec = (side: number, length: number, width: number = LANE_WIDTH): BoxSpec =>
  box(
    [WALL_THICKNESS, WALL_FULL_HEIGHT, length],
    vec((side * (width + WALL_THICKNESS)) / 2, WALL_CENTER_Y, 0)
  )

const laneSegmentSpecs = (length: number, width: number = LANE_WIDTH): BoxSpec[] => [
  laneDeckSpec(length, width),
  laneWallSpec(-1, length, width),
  laneWallSpec(1, length, width)
]

const straightSpecs = (length: number): BoxSpec[] =>
  transformSpecs(laneSegmentSpecs(length), IDENTITY_QUATERNION, vec(0, 0, -length / 2))

const crossWallSpec = (z: number, width: number = LANE_WIDTH): BoxSpec =>
  box([width + 2 * WALL_THICKNESS, WALL_FULL_HEIGHT, WALL_THICKNESS], vec(0, WALL_CENTER_Y, z))

const rampSpecs = (direction: 1 | -1): BoxSpec[] =>
  transformSpecs(straightSpecs(RAMP_LENGTH), pitchQuaternion(direction * RAMP_ANGLE), ZERO_VECTOR)

const arcSegmentSpecs = (side: 1 | -1, roll: number): BoxSpec[] => {
  const delta = Math.PI / 2 / CURVE_SEGMENTS
  const chord = 2 * CURVE_RADIUS * Math.sin(delta / 2) * CURVE_CHORD_OVERLAP
  return Array.from({ length: CURVE_SEGMENTS }, (_, index) => index).flatMap((index) => {
    const phi = (index + 0.5) * delta
    const midpoint = vec(
      side * (CURVE_RADIUS * Math.cos(phi) - CURVE_RADIUS),
      0,
      -CURVE_RADIUS * Math.sin(phi)
    )
    const orientation = yawQuaternion(side * phi).multiply(rollQuaternion(side * roll))
    return transformSpecs(laneSegmentSpecs(chord), orientation, midpoint)
  })
}

const funnelBoxSpecs = (): PieceParts['boxes'] => {
  const bowlCenterZ = -(FUNNEL_TONGUE_LENGTH + FUNNEL_RIM_RADIUS)
  const lowerStartZ = bowlCenterZ + FUNNEL_HOLE_RADIUS * 2
  const lowerLength = -FUNNEL_EXIT_LENGTH - lowerStartZ
  const lowerCenter = vec(0, -FUNNEL_DROP_HEIGHT, lowerStartZ + lowerLength / 2)
  return [
    ...straightSpecs(FUNNEL_TONGUE_LENGTH),
    ...transformSpecs(laneSegmentSpecs(-lowerLength), IDENTITY_QUATERNION, lowerCenter),
    transformSpec(
      crossWallSpec(0),
      IDENTITY_QUATERNION,
      vec(0, -FUNNEL_DROP_HEIGHT, lowerStartZ - WALL_THICKNESS / 2)
    )
  ]
}

const funnelLatheSpec = (): LatheSpec => ({
  profile: [
    [FUNNEL_HOLE_RADIUS, -FUNNEL_BOWL_DEPTH],
    [FUNNEL_HOLE_RADIUS + 0.6, -FUNNEL_BOWL_DEPTH + 0.7],
    [FUNNEL_HOLE_RADIUS + 1.6, -FUNNEL_BOWL_DEPTH + 1.7],
    [FUNNEL_HOLE_RADIUS + 2.9, -FUNNEL_BOWL_DEPTH + 2.8],
    [FUNNEL_RIM_RADIUS - 0.6, -0.4],
    [FUNNEL_RIM_RADIUS, 0],
    [FUNNEL_RIM_RADIUS + 0.5, 0.4]
  ].map(([radius, height]) => new THREE.Vector2(radius, height)),
  center: vec(0, 0, -(FUNNEL_TONGUE_LENGTH + FUNNEL_RIM_RADIUS)),
  friction: 0.4
})

const LOOP_GUIDE_LENGTH = Math.hypot(4, (LANE_WIDTH - LOOP_LANE_WIDTH) / 2)
const LOOP_GUIDE_YAW = Math.atan2((LANE_WIDTH - LOOP_LANE_WIDTH) / 2, 4)
const LOOP_EXIT_START_Z = -9.5
const LOOP_EXIT_WIDTH = 5

const loopEntrySpecs = (): BoxSpec[] => {
  const entryLength = -LOOP_BOTTOM_Z
  return [
    transformSpec(laneDeckSpec(entryLength), IDENTITY_QUATERNION, vec(0, 0, -entryLength / 2)),
    transformSpec(laneWallSpec(-1, entryLength), IDENTITY_QUATERNION, vec(0, 0, -entryLength / 2)),
    transformSpec(
      laneWallSpec(1, entryLength - 4),
      IDENTITY_QUATERNION,
      vec(0, 0, -(entryLength - 4) / 2)
    ),
    ...[-1, 1].map((side) =>
      transformSpec(
        box([WALL_THICKNESS, WALL_FULL_HEIGHT, LOOP_GUIDE_LENGTH], vec(0, WALL_CENTER_Y, 0)),
        yawQuaternion(side * LOOP_GUIDE_YAW),
        vec(side * ((LANE_WIDTH + LOOP_LANE_WIDTH) / 4), 0, LOOP_BOTTOM_Z + 2)
      )
    )
  ]
}

const loopRingSpecs = (): BoxSpec[] => {
  const span = 2 * Math.PI - 2 * LOOP_GAP_ANGLE
  const delta = span / LOOP_SEGMENTS
  const chord = 2 * LOOP_RADIUS * Math.sin(delta / 2) * CURVE_CHORD_OVERLAP
  return Array.from({ length: LOOP_SEGMENTS }, (_, index) => index).flatMap((index) => {
    const phi = LOOP_GAP_ANGLE + (index + 0.5) * delta
    const midpoint = vec(
      LOOP_X_SHIFT * (phi / (2 * Math.PI)),
      LOOP_RADIUS - LOOP_RADIUS * Math.cos(phi),
      LOOP_BOTTOM_Z - LOOP_RADIUS * Math.sin(phi)
    )
    return transformSpecs(laneSegmentSpecs(chord, LOOP_LANE_WIDTH), pitchQuaternion(phi), midpoint)
  })
}

const loopExitSpecs = (): BoxSpec[] => {
  const startPoint = vec(LOOP_X_SHIFT, 0, LOOP_EXIT_START_Z)
  const endPoint = vec(0, 0, -LOOP_EXIT_LENGTH)
  const length = startPoint.distanceTo(endPoint)
  const yaw = Math.atan2(LOOP_X_SHIFT, LOOP_EXIT_LENGTH + LOOP_EXIT_START_Z)
  const midpoint = startPoint.clone().add(endPoint).multiplyScalar(0.5)
  return transformSpecs(laneSegmentSpecs(length, LOOP_EXIT_WIDTH), yawQuaternion(yaw), midpoint)
}

const gapJumpSpecs = (): BoxSpec[] => {
  const landingLength = -GAP_JUMP_LENGTH - GAP_LANDING_START
  const landingCenter = vec(0, -GAP_JUMP_DROP, GAP_LANDING_START + landingLength / 2)
  return [
    ...transformSpecs(straightSpecs(GAP_RAMP_LENGTH), pitchQuaternion(GAP_RAMP_ANGLE), ZERO_VECTOR),
    ...transformSpecs(laneSegmentSpecs(-landingLength), IDENTITY_QUATERNION, landingCenter)
  ]
}

const boostPadSpecs = (): BoxSpec[] => [
  ...straightSpecs(BOOST_PAD_LENGTH),
  box(
    [LANE_WIDTH - 2 * BOOST_PAD_INSET, 0.1, BOOST_PAD_LENGTH - 2],
    vec(0, 0.05, -BOOST_PAD_LENGTH / 2),
    { color: COLOR_BOOST }
  )
]

const bumperFieldSpecs = (): BoxSpec[] => [
  ...straightSpecs(BUMPER_FIELD_LENGTH),
  ...[
    [1.8, -4],
    [-1.8, -8],
    [1.8, -12]
  ].map(([x, z]) =>
    box([BUMPER_SIZE_XZ, BUMPER_HEIGHT, BUMPER_SIZE_XZ], vec(x, BUMPER_HEIGHT / 2, z), {
      color: COLOR_BUMPER,
      restitution: BUMPER_RESTITUTION
    })
  )
]

const boxesOnly = (boxes: BoxSpec[]): PieceParts => ({ boxes, lathes: [] })

const PIECE_PARTS_BUILDERS: Record<TrackPieceType, () => PieceParts> = {
  start: () => boxesOnly([...straightSpecs(START_LENGTH), crossWallSpec(WALL_THICKNESS / 2)]),
  finish: () =>
    boxesOnly([
      ...straightSpecs(FINISH_LENGTH),
      crossWallSpec(-FINISH_LENGTH + WALL_THICKNESS / 2)
    ]),
  'straight-short': () => boxesOnly(straightSpecs(STRAIGHT_SHORT_LENGTH)),
  'straight-long': () => boxesOnly(straightSpecs(STRAIGHT_LONG_LENGTH)),
  'curve-left': () => boxesOnly(arcSegmentSpecs(1, 0)),
  'curve-right': () => boxesOnly(arcSegmentSpecs(-1, 0)),
  'banked-left': () => boxesOnly(arcSegmentSpecs(1, BANK_ANGLE)),
  'banked-right': () => boxesOnly(arcSegmentSpecs(-1, BANK_ANGLE)),
  'ramp-up': () => boxesOnly(rampSpecs(1)),
  'ramp-down': () => boxesOnly(rampSpecs(-1)),
  funnel: () => ({ boxes: funnelBoxSpecs(), lathes: [funnelLatheSpec()] }),
  loop: () => boxesOnly([...loopEntrySpecs(), ...loopRingSpecs(), ...loopExitSpecs()]),
  'gap-jump': () => boxesOnly(gapJumpSpecs()),
  'boost-pad': () => boxesOnly(boostPadSpecs()),
  'bumper-field': () => boxesOnly(bumperFieldSpecs())
}

const buildBoxModel = (
  scene: THREE.Scene,
  world: RAPIER.World,
  piece: PlacedPiece,
  spec: BoxSpec
): ComplexModel => {
  const model = getCube(scene, world, {
    name: `piece-${piece.id}`,
    size: spec.size,
    position: [0, 0, 0],
    type: 'fixed',
    color: spec.color ?? piece.color,
    friction: spec.friction ?? DECK_FRICTION,
    restitution: spec.restitution ?? DECK_RESTITUTION
  })
  model.position.copy(spec.center)
  model.quaternion.copy(spec.quaternion)
  model.userData.body.setTranslation({ x: spec.center.x, y: spec.center.y, z: spec.center.z }, true)
  model.userData.body.setRotation(
    { x: spec.quaternion.x, y: spec.quaternion.y, z: spec.quaternion.z, w: spec.quaternion.w },
    true
  )
  model.userData.pieceId = piece.id
  return model
}

const buildLatheModel = (
  scene: THREE.Scene,
  world: RAPIER.World,
  piece: PlacedPiece,
  spec: LatheSpec,
  transform: PieceTransform
): ComplexModel => {
  const geometry = new THREE.LatheGeometry(spec.profile, 32)
  const worldCenter = spec.center
    .clone()
    .applyQuaternion(yawQuaternion(transform.yaw))
    .add(vec(...transform.position))
  const model = getTrimesh(scene, world, geometry, {
    name: `piece-${piece.id}`,
    position: [worldCenter.x, worldCenter.y, worldCenter.z],
    rotation: [0, transform.yaw, 0],
    color: piece.color,
    friction: spec.friction,
    restitution: 0.1
  })
  const material = model.material as THREE.Material
  material.side = THREE.DoubleSide
  model.userData.pieceId = piece.id
  return model
}

export const buildPieceModels = (
  scene: THREE.Scene,
  world: RAPIER.World,
  piece: PlacedPiece,
  transform: PieceTransform
): ComplexModel[] => {
  const parts = PIECE_PARTS_BUILDERS[piece.type]()
  const worldQuaternion = yawQuaternion(transform.yaw)
  const worldTranslation = vec(...transform.position)
  const boxModels = parts.boxes.map((spec) =>
    buildBoxModel(scene, world, piece, transformSpec(spec, worldQuaternion, worldTranslation))
  )
  const latheModels = parts.lathes.map((spec) =>
    buildLatheModel(scene, world, piece, spec, transform)
  )
  return [...boxModels, ...latheModels]
}
