import type * as THREE from 'three'
import type { CoordinateTuple } from '@webgamekit/threejs'

/** Where the logo's feet start, asleep in the corner, and where they land. */
export interface LogoJumpPath {
  start: CoordinateTuple
  end: CoordinateTuple
}

/** The logo's pose at one instant of the intro, pivoting on the centre of its base. */
export interface LogoIntroPose {
  feet: CoordinateTuple
  tilt: number
  yaw: number
  eyeOpenness: number
  lightProgress: number
  done: boolean
}

/** The room's wall and floor, lit by the same lights as the logo. */
export interface Room {
  meshes: THREE.Mesh[]
  materials: THREE.MeshStandardMaterial[]
}

/** The offset from the logo's feet to its origin, at rest. */
export interface LogoRest {
  feetOffset: THREE.Vector3
}

/** The skills city scene, ready to render into its own canvas. */
export interface SkillsCityStage {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.OrthographicCamera
  outline: THREE.Vector3[]
  districts: THREE.Object3D[]
  movers: CityMover[]
  /** The blank screen on the sign behind the city, which the page's LED display covers. */
  screen: THREE.Object3D | null
}

/** Where a part of the city sits on the canvas, as fractions of the canvas's width and height. */
export interface CanvasRect {
  left: number
  top: number
  width: number
  height: number
}

/** How a moving part of the city moves, as tagged on its node in Blender. */
export type MotionKind =
  | 'spin'
  | 'swing'
  | 'bob'
  | 'slide'
  | 'puff'
  | 'grow'
  | 'pulse'
  | 'stretch'
  | 'arc'
  | 'route'

/** One moving part, with the motion it plays and the pose it moves from. */
export interface CityMover {
  object: THREE.Object3D
  kind: MotionKind
  axis: 'x' | 'y' | 'z'
  speed: number
  amount: number
  phase: number
  lift: number
  basePosition: THREE.Vector3
  baseRotation: THREE.Euler
  baseScale: THREE.Vector3
  fadeMaterials: THREE.Material[]
  /** The course a `route` part sails, in the model's ground plane; empty for every other kind. */
  route: RouteSegment[]
}

/** One straight leg of a course, in Blender's ground plane, and how far along the course it starts. */
export interface RouteSegment {
  startX: number
  startY: number
  endX: number
  endY: number
  offset: number
  length: number
}

/** Where a part sailing a course is, in Blender's ground plane, and the way it is heading. */
export interface RouteSpot {
  x: number
  y: number
  heading: number
}

/** A point in the market section's own pixel space. */
export interface TracePoint {
  x: number
  y: number
}

/** A sector's cell in the market section's pixel space, and where its icon begins. */
export interface TraceCell {
  left: number
  top: number
  width: number
  iconTop: number
}

/** How the traces from the city to the sectors are spaced, in pixels. */
export interface TraceSpacing {
  /** How far below the section's top the highest trace turns towards its lane. */
  busTop: number
  /** The distance between neighbouring traces where they run side by side. */
  busStep: number
  /** How far left of its cell a column's lane runs: half the gap between columns. */
  laneGap: number
  laneStep: number
  /** How far above a cell's top rule the trace runs along it, so the rule does not cover it. */
  runAbove: number
  cornerRadius: number
}

/** One trace from the city to a sector, as an SVG path and the point it arrives at. */
export interface SectorTrace {
  path: string
  end: TracePoint
}
