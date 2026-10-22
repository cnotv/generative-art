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
  /** The room's own repeat of the paper texture, to dispose with the room. */
  paper: THREE.Texture
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

/** One market sector's avatar: its model and the camera that frames it. */
export interface SectorAvatar {
  object: THREE.Object3D
  camera: THREE.OrthographicCamera
}

/** The market avatars' shared renderer and scene, one avatar per sector in page order. */
export interface AvatarStage {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  avatars: (SectorAvatar | null)[]
}

/** A rectangle in WebGL viewport terms: pixels from the canvas's bottom-left corner. */
export interface ViewportRect {
  x: number
  y: number
  width: number
  height: number
}

/** A point in the market section's own pixel space. */
export interface TracePoint {
  x: number
  y: number
}

/** One arrow from the city to a sector, as an SVG path and the point it arrives at. */
export interface SectorTrace {
  path: string
  end: TracePoint
}

/** One role's achievements in a skill's drawer, with where and when they happened. */
export interface SkillHighlight {
  company: string
  period: string
  points: string[]
}

/** An area of work: its district in the skills city and what its drawer shows a recruiter. */
export interface SkillArea {
  district: string
  title: string
  line: string
  tools: string[]
  highlights: SkillHighlight[]
  quote?: { text: string; author: string; url: string }
}

/** Where a spotlight hangs relative to what it lights, and the shape of its beam. */
export interface SpotPlacement {
  color: number
  intensity: number
  side: number
  height: number
  forward: number
  angle: number
  penumbra: number
}

/** A directional light: its colour, strength and where it shines from. */
export interface KeyLight {
  color: number
  intensity: number
  position: readonly [number, number, number]
}

/** A finish for the hero room: its colours, its lights and how the logo is made. */
export interface HeroLook {
  label: string
  wallColor: number
  floorColor: number
  logoColor: number
  logoRoughness: number
  /** Whether the room and logo are cardstock, with grain, fibres and tooth. */
  paper: boolean
  embossStrength: number
  rimStrength: number
  ambientIntensity: number
  key: KeyLight
  spot: SpotPlacement
  /** How far shadows blur at their edges, in shadow map texels. */
  shadowRadius: number
  /** Dark text for a light page, instead of light text for a dark one. */
  ink: boolean
}

/** Everything in the hero a look changes: the lights, the room and the logo. */
export interface HeroLookParts {
  ambientLight: THREE.AmbientLight
  keyLight: THREE.DirectionalLight
  spot: THREE.SpotLight
  wallMaterial: THREE.MeshStandardMaterial
  floorMaterial: THREE.MeshStandardMaterial
  roomPaper: THREE.Texture
  logoMaterial: THREE.MeshStandardMaterial
  logoPaper: THREE.Texture
  emboss: THREE.IUniform<number>
  rim: THREE.IUniform<number>
}
