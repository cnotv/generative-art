import * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import { getCube, getTrimesh } from '@webgamekit/threejs'
import type { ComplexModel, CoordinateTuple } from '@webgamekit/animation'
import type { PlacedPiece, PieceTransform, TrackPieceType } from './types'
import { PIECE_CATALOG } from './pieceCatalog'
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
  BANK_ANGLE,
  BANK_BLEND_ANGLE,
  RAMP_LENGTH,
  RAMP_ANGLE,
  RAMP_LIP_LENGTH,
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
  LOOP_WALL_HEIGHT,
  LOOP_RING_SINK,
  LOOP_RING_FRICTION,
  LOOP_CHORD_OVERLAP,
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
  BUMPER_LATERAL_OFFSET,
  BUMPER_SPACING_Z,
  DECK_FRICTION,
  DECK_RESTITUTION,
  WALL_FRICTION,
  WALL_DECK_OVERLAP,
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

type TrimeshSpec = {
  geometry: THREE.BufferGeometry
  center: THREE.Vector3
  friction: number
  restitution?: number
}

type PieceParts = {
  boxes: BoxSpec[]
  trimeshes: TrimeshSpec[]
}

const Y_AXIS = new THREE.Vector3(0, 1, 0)
const X_AXIS = new THREE.Vector3(1, 0, 0)
const Z_AXIS = new THREE.Vector3(0, 0, 1)
const IDENTITY_QUATERNION = new THREE.Quaternion()

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

// Lane boxes are slightly longer than their nominal span so neighbouring
// segments and pieces overlap: flush box seams leave hairline cracks that
// wedge a fast marble.
const JOINT_OVERLAP = 0.3

const laneDeckSpec = (length: number, width: number = LANE_WIDTH): BoxSpec =>
  box([width, DECK_THICKNESS, length + JOINT_OVERLAP], vec(0, -DECK_THICKNESS / 2, 0))

// Walls are near-frictionless rails (a grinding marble keeps its speed) and
// overlap the deck edge so the two boxes share volume: a flush box-to-box
// seam leaves a hairline crack the physics solver can wedge the marble into.
const laneWallSpec = (
  side: number,
  length: number,
  width: number = LANE_WIDTH,
  wallHeight: number = WALL_HEIGHT
): BoxSpec =>
  box(
    [WALL_THICKNESS + WALL_DECK_OVERLAP, wallHeight + DECK_THICKNESS, length + JOINT_OVERLAP],
    vec(
      side * ((width + WALL_THICKNESS - WALL_DECK_OVERLAP) / 2),
      (wallHeight - DECK_THICKNESS) / 2,
      0
    ),
    { friction: WALL_FRICTION }
  )

const laneSegmentSpecs = (
  length: number,
  width: number = LANE_WIDTH,
  wallHeight: number = WALL_HEIGHT
): BoxSpec[] => [
  laneDeckSpec(length, width),
  laneWallSpec(-1, length, width, wallHeight),
  laneWallSpec(1, length, width, wallHeight)
]

const straightSpecs = (length: number): BoxSpec[] =>
  transformSpecs(laneSegmentSpecs(length), IDENTITY_QUATERNION, vec(0, 0, -length / 2))

const crossWallSpec = (z: number, width: number = LANE_WIDTH): BoxSpec =>
  box([width + 2 * WALL_THICKNESS, WALL_FULL_HEIGHT, WALL_THICKNESS], vec(0, WALL_CENTER_Y, z), {
    friction: WALL_FRICTION
  })

// Flat lips at both ends make the sloped section meet neighbouring pieces
// with perfectly level junctions.
const rampSpecs = (direction: 1 | -1): BoxSpec[] => {
  const rise = direction * RAMP_LENGTH * Math.sin(RAMP_ANGLE)
  const run = RAMP_LENGTH * Math.cos(RAMP_ANGLE)
  return [
    ...straightSpecs(RAMP_LIP_LENGTH),
    ...transformSpecs(
      straightSpecs(RAMP_LENGTH),
      pitchQuaternion(direction * RAMP_ANGLE),
      vec(0, 0, -RAMP_LIP_LENGTH)
    ),
    ...transformSpecs(
      straightSpecs(RAMP_LIP_LENGTH),
      IDENTITY_QUATERNION,
      vec(0, rise, -(RAMP_LIP_LENGTH + run))
    )
  ]
}

// The roll eases in and out across the arc so banked curves start and end
// perfectly level against neighbouring pieces.
const bankEnvelope = (phi: number): number =>
  Math.max(0, Math.min(1, phi / BANK_BLEND_ANGLE, (Math.PI / 2 - phi) / BANK_BLEND_ANGLE))

// Closed outline of the lane profile (deck plus both walls), swept along the
// arc to produce a single smooth solid instead of segmented boxes.
const LANE_CROSS_SECTION: [number, number][] = [
  [-(LANE_WIDTH / 2 + WALL_THICKNESS), -DECK_THICKNESS],
  [-(LANE_WIDTH / 2 + WALL_THICKNESS), WALL_HEIGHT],
  [-LANE_WIDTH / 2, WALL_HEIGHT],
  [-LANE_WIDTH / 2, 0],
  [LANE_WIDTH / 2, 0],
  [LANE_WIDTH / 2, WALL_HEIGHT],
  [LANE_WIDTH / 2 + WALL_THICKNESS, WALL_HEIGHT],
  [LANE_WIDTH / 2 + WALL_THICKNESS, -DECK_THICKNESS]
]

const ARC_SWEEP_STATIONS = 49

type SweepStation = {
  origin: THREE.Vector3
  orientation: THREE.Quaternion
}

// Arc stations plus a short straight extension at both ends: the extensions
// overlap the neighbouring pieces so the junctions never leave a flush seam,
// mirroring the box pieces' JOINT_OVERLAP.
const arcSweepStations = (side: 1 | -1, roll: number): SweepStation[] => {
  const arc = Array.from({ length: ARC_SWEEP_STATIONS }, (_, index) => {
    const phi = (index / (ARC_SWEEP_STATIONS - 1)) * (Math.PI / 2)
    return {
      origin: vec(
        side * (CURVE_RADIUS * Math.cos(phi) - CURVE_RADIUS),
        0,
        -CURVE_RADIUS * Math.sin(phi)
      ),
      orientation: yawQuaternion(side * phi).multiply(
        rollQuaternion(side * roll * bankEnvelope(phi))
      )
    }
  })
  const last = arc[arc.length - 1]
  const entry: SweepStation = {
    origin: vec(0, 0, JOINT_OVERLAP / 2),
    orientation: new THREE.Quaternion()
  }
  const exit: SweepStation = {
    origin: last.origin.clone().add(vec(-side * (JOINT_OVERLAP / 2), 0, 0)),
    orientation: last.orientation.clone()
  }
  return [entry, ...arc, exit]
}

// Each cross-section edge gets its own vertex pair per station: profile
// corners stay hard while the sweep direction shades smoothly.
const sweepPositions = (stations: SweepStation[]): number[] =>
  stations.flatMap((station) =>
    LANE_CROSS_SECTION.flatMap((current, pointIndex) => {
      const nextPoint = LANE_CROSS_SECTION[(pointIndex + 1) % LANE_CROSS_SECTION.length]
      return [current, nextPoint].flatMap(([x, y]) => {
        const point = vec(x, y, 0).applyQuaternion(station.orientation).add(station.origin)
        return [point.x, point.y, point.z]
      })
    })
  )

// Winding matters: Rapier's FIX_INTERNAL_EDGES corrects contact normals using
// the triangles' face normals, so every face must point outward (deck up).
const sweepIndices = (stationCount: number): number[] => {
  const edgeCount = LANE_CROSS_SECTION.length
  const perStation = edgeCount * 2
  const sideQuads = Array.from({ length: stationCount - 1 }, (_, station) =>
    Array.from({ length: edgeCount }, (_, edge) => {
      const a = station * perStation + edge * 2
      const b = a + 1
      const c = (station + 1) * perStation + edge * 2
      const d = c + 1
      return [a, b, c, b, d, c]
    }).flat()
  ).flat()
  const capTriangles = THREE.ShapeUtils.triangulateShape(
    LANE_CROSS_SECTION.map(([x, y]) => new THREE.Vector2(x, y)),
    []
  )
  const endBase = (stationCount - 1) * perStation
  const caps = capTriangles.flatMap(([a, b, c]) => [
    a * 2,
    b * 2,
    c * 2,
    endBase + a * 2,
    endBase + c * 2,
    endBase + b * 2
  ])
  return [...sideQuads, ...caps]
}

export const buildArcSweepGeometry = (side: 1 | -1, roll: number): THREE.BufferGeometry => {
  const stations = arcSweepStations(side, roll)
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(sweepPositions(stations), 3))
  geometry.setIndex(sweepIndices(stations.length))
  geometry.computeVertexNormals()
  return geometry
}

const arcTrimeshSpec = (side: 1 | -1, roll: number): TrimeshSpec => ({
  geometry: buildArcSweepGeometry(side, roll),
  center: new THREE.Vector3(0, 0, 0),
  friction: DECK_FRICTION,
  restitution: DECK_RESTITUTION
})

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

const FUNNEL_PROFILE: [number, number][] = [
  [FUNNEL_HOLE_RADIUS, -FUNNEL_BOWL_DEPTH],
  [FUNNEL_HOLE_RADIUS + 0.6, -FUNNEL_BOWL_DEPTH + 0.7],
  [FUNNEL_HOLE_RADIUS + 1.6, -FUNNEL_BOWL_DEPTH + 1.7],
  [FUNNEL_HOLE_RADIUS + 2.9, -FUNNEL_BOWL_DEPTH + 2.8],
  [FUNNEL_RIM_RADIUS - 0.6, -0.4],
  [FUNNEL_RIM_RADIUS, 0],
  [FUNNEL_RIM_RADIUS + 0.5, 0.4]
]

// THREE.LatheGeometry winds its faces toward the outside of the solid of
// revolution; the marble rolls on the bowl's inside, so the winding must be
// reversed for Rapier's FIX_INTERNAL_EDGES normal correction to point up.
const reverseGeometryWinding = (geometry: THREE.BufferGeometry): THREE.BufferGeometry => {
  const index = geometry.getIndex()
  if (!index) return geometry
  const flipped = Array.from({ length: index.count / 3 }, (_, triangle) => [
    index.getX(triangle * 3),
    index.getX(triangle * 3 + 2),
    index.getX(triangle * 3 + 1)
  ]).flat()
  geometry.setIndex(flipped)
  geometry.computeVertexNormals()
  return geometry
}

export const buildFunnelGeometry = (): THREE.BufferGeometry =>
  reverseGeometryWinding(
    new THREE.LatheGeometry(
      FUNNEL_PROFILE.map(([radius, height]) => new THREE.Vector2(radius, height)),
      32
    )
  )

const funnelTrimeshSpec = (): TrimeshSpec => ({
  geometry: buildFunnelGeometry(),
  center: vec(0, 0, -(FUNNEL_TONGUE_LENGTH + FUNNEL_RIM_RADIUS)),
  friction: 0.4,
  restitution: 0.01
})

const LOOP_GUIDE_LENGTH = Math.hypot(4, (LANE_WIDTH - LOOP_LANE_WIDTH) / 2)
const LOOP_GUIDE_YAW = Math.atan2((LANE_WIDTH - LOOP_LANE_WIDTH) / 2, 4)
const LOOP_EXIT_START_Z = -8

const loopEntrySpecs = (): BoxSpec[] => {
  const entryLength = -LOOP_BOTTOM_Z + 1
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
        box([WALL_THICKNESS, WALL_FULL_HEIGHT, LOOP_GUIDE_LENGTH], vec(0, WALL_CENTER_Y, 0), {
          friction: WALL_FRICTION
        }),
        yawQuaternion(side * LOOP_GUIDE_YAW),
        vec(side * ((LANE_WIDTH + LOOP_LANE_WIDTH) / 4), 0, LOOP_BOTTOM_Z + 2)
      )
    )
  ]
}

const HALF_PI = Math.PI / 2

// The lateral shift starts only past the loop top's approach: the ascending
// quarter stays perfectly straight so the climb never grinds against wall edges.
const loopRingXShift = (phi: number): number => {
  const endPhi = 2 * Math.PI - LOOP_GAP_ANGLE
  if (phi <= HALF_PI) return 0
  return (LOOP_X_SHIFT * (phi - HALF_PI)) / (endPhi - HALF_PI)
}

const loopRingSpecs = (): BoxSpec[] => {
  const span = 2 * Math.PI - 2 * LOOP_GAP_ANGLE
  const delta = span / LOOP_SEGMENTS
  const chord = 2 * LOOP_RADIUS * Math.sin(delta / 2) * LOOP_CHORD_OVERLAP
  return Array.from({ length: LOOP_SEGMENTS }, (_, index) => index).flatMap((index) => {
    const phi = LOOP_GAP_ANGLE + (index + 0.5) * delta
    const midpoint = vec(
      loopRingXShift(phi),
      LOOP_RADIUS - LOOP_RADIUS * Math.cos(phi) - LOOP_RING_SINK,
      LOOP_BOTTOM_Z - LOOP_RADIUS * Math.sin(phi)
    )
    return transformSpecs(
      laneSegmentSpecs(chord, LOOP_LANE_WIDTH, LOOP_WALL_HEIGHT),
      pitchQuaternion(phi),
      midpoint
    ).map((spec) => ({ ...spec, friction: LOOP_RING_FRICTION }))
  })
}

// The walls stop before the junction with the next piece: the diagonal meets
// the following lane at an angle, and full-length walls would form a wedge
// pocket that traps the marble.
// The ring lands onto a full-width straight exit lane displaced exactly one
// lane width to the left of the entry, running parallel to it.
const loopExitSpecs = (): BoxSpec[] => {
  const length = LOOP_EXIT_LENGTH + LOOP_EXIT_START_Z
  const center = vec(LOOP_X_SHIFT, 0, LOOP_EXIT_START_Z - length / 2)
  return transformSpecs(laneSegmentSpecs(length), IDENTITY_QUATERNION, center)
}

const gapJumpSpecs = (): BoxSpec[] => {
  const landingLength = -GAP_JUMP_LENGTH - GAP_LANDING_START
  const landingCenter = vec(0, -GAP_JUMP_DROP, GAP_LANDING_START + landingLength / 2)
  return [
    ...straightSpecs(RAMP_LIP_LENGTH),
    ...transformSpecs(
      straightSpecs(GAP_RAMP_LENGTH),
      pitchQuaternion(GAP_RAMP_ANGLE),
      vec(0, 0, -RAMP_LIP_LENGTH)
    ),
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

// Bumpers keep more than a marble diameter of clearance to the walls (an
// exact-diameter gap pinches the marble against both) and sink into the deck
// like the walls do, so the base seam cannot wedge a fast marble.
const bumperFieldSpecs = (): BoxSpec[] => [
  ...straightSpecs(BUMPER_FIELD_LENGTH),
  ...[1, -1, 1].map((side, index) =>
    box(
      [BUMPER_SIZE_XZ, BUMPER_HEIGHT + WALL_DECK_OVERLAP, BUMPER_SIZE_XZ],
      vec(
        side * BUMPER_LATERAL_OFFSET,
        (BUMPER_HEIGHT - WALL_DECK_OVERLAP) / 2,
        -(index + 1) * BUMPER_SPACING_Z
      ),
      {
        color: COLOR_BUMPER,
        restitution: BUMPER_RESTITUTION
      }
    )
  )
]

const boxesOnly = (boxes: BoxSpec[]): PieceParts => ({ boxes, trimeshes: [] })

const PIECE_PARTS_BUILDERS: Record<TrackPieceType, () => PieceParts> = {
  start: () => boxesOnly([...straightSpecs(START_LENGTH), crossWallSpec(WALL_THICKNESS / 2)]),
  finish: () =>
    boxesOnly([
      ...straightSpecs(FINISH_LENGTH),
      crossWallSpec(-FINISH_LENGTH + WALL_THICKNESS / 2)
    ]),
  'straight-short': () => boxesOnly(straightSpecs(STRAIGHT_SHORT_LENGTH)),
  'straight-long': () => boxesOnly(straightSpecs(STRAIGHT_LONG_LENGTH)),
  'curve-left': () => ({ boxes: [], trimeshes: [arcTrimeshSpec(1, 0)] }),
  'curve-right': () => ({ boxes: [], trimeshes: [arcTrimeshSpec(-1, 0)] }),
  'banked-left': () => ({ boxes: [], trimeshes: [arcTrimeshSpec(1, BANK_ANGLE)] }),
  'banked-right': () => ({ boxes: [], trimeshes: [arcTrimeshSpec(-1, BANK_ANGLE)] }),
  'ramp-up': () => boxesOnly(rampSpecs(1)),
  'ramp-down': () => boxesOnly(rampSpecs(-1)),
  funnel: () => ({ boxes: funnelBoxSpecs(), trimeshes: [funnelTrimeshSpec()] }),
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

const buildTrimeshModel = (
  scene: THREE.Scene,
  world: RAPIER.World,
  piece: PlacedPiece,
  spec: TrimeshSpec,
  transform: PieceTransform
): ComplexModel => {
  const worldCenter = spec.center
    .clone()
    .applyQuaternion(yawQuaternion(transform.yaw))
    .add(vec(...transform.position))
  const model = getTrimesh(scene, world, spec.geometry, {
    name: `piece-${piece.id}`,
    position: [worldCenter.x, worldCenter.y, worldCenter.z],
    rotation: [0, transform.yaw, 0],
    color: piece.color,
    friction: spec.friction,
    restitution: spec.restitution ?? 0.01
  })
  const material = model.material as THREE.Material
  material.side = THREE.DoubleSide
  model.userData.pieceId = piece.id
  return model
}

const GHOST_OPACITY = 0.45

const makeGhostMaterial = (color: number): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({
    color,
    transparent: true,
    opacity: GHOST_OPACITY,
    depthWrite: false,
    side: THREE.DoubleSide
  })

export const buildPieceGhost = (
  scene: THREE.Scene,
  type: TrackPieceType,
  transform: PieceTransform
): THREE.Group => {
  const parts = PIECE_PARTS_BUILDERS[type]()
  const worldQuaternion = yawQuaternion(transform.yaw)
  const worldTranslation = vec(...transform.position)
  const group = new THREE.Group()
  const defaultColor = PIECE_CATALOG[type].defaultColor
  parts.boxes
    .map((spec) => transformSpec(spec, worldQuaternion, worldTranslation))
    .forEach((spec) => {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(...spec.size),
        makeGhostMaterial(spec.color ?? defaultColor)
      )
      mesh.position.copy(spec.center)
      mesh.quaternion.copy(spec.quaternion)
      group.add(mesh)
    })
  parts.trimeshes.forEach((spec) => {
    const mesh = new THREE.Mesh(spec.geometry, makeGhostMaterial(defaultColor))
    mesh.position.copy(spec.center.clone().applyQuaternion(worldQuaternion).add(worldTranslation))
    mesh.quaternion.copy(worldQuaternion)
    group.add(mesh)
  })
  scene.add(group)
  return group
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
  const trimeshModels = parts.trimeshes.map((spec) =>
    buildTrimeshModel(scene, world, piece, spec, transform)
  )
  return [...boxModels, ...trimeshModels]
}
