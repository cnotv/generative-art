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
}
