import * as THREE from 'three'
import type { CoordinateTuple, ModelType } from '@webgamekit/animation'

// Re-export for convenience
export type { CoordinateTuple, ModelType, ComplexModel, Model } from '@webgamekit/animation'

export type Vec3 = { x: number; y: number; z: number }

export interface CommonOptions {
  boundary?: number
  contactSkin?: number
  damping?: number
  angular?: number
  density?: number
  dominance?: number
  friction?: number
  mass?: number
  position?: CoordinateTuple
  restitution?: number
  rotation?: CoordinateTuple
  size?: number | CoordinateTuple
  type?: ModelType
  weight?: number
  enabledRotations?: [boolean, boolean, boolean]
}

export interface ModelOptions extends CommonOptions {
  name?: string
  color?: number
  opacity?: number
  reflectivity?: number
  roughness?: number
  metalness?: number
  displacementScale?: number
  transmission?: number
  transparent?: boolean
  material?: THREE.Material | typeof THREE.Material | string | boolean
  segments?: number
  setUV2?: boolean
  rotation?: CoordinateTuple
  scale?: CoordinateTuple
  shape?: 'cuboid' | 'ball' | 'cylinder'
  castShadow?: boolean
  receiveShadow?: boolean
  hasGravity?: boolean
  gravityScale?: number
  showHelper?: boolean
  helperColor?: number
  texture?: string
  /**
   * How many times the texture tiles across the surface, as [horizontal, vertical].
   *
   * Without it a texture is stretched once over whatever it is put on, so the same marble
   * reads at a different scale on a step than on a column. Repeating by size keeps the grain
   * the same size wherever it appears.
   */
  textureRepeat?: [number, number]
  textures?: {
    random: boolean
    list: string[]
  }
  origin?: { x?: number; y?: number; z?: number }
  wireframe?: boolean
  depthWrite?: boolean
  alphaTest?: number
  renderOrder?: number
  side?: THREE.Side
  clearcoat?: number
  clearcoatRoughness?: number
  ior?: number
  thickness?: number
  envMapIntensity?: number
  animations?: string[]
  materialColors?: number[]
  /** Degrees to add to the model's facing so a front/back-inverted model faces its travel direction (e.g. 180) */
  facingOffset?: number
  /** Face the model along the mirrored (left/right-swapped) heading, for models authored to turn the mirror-image way */
  mirroredFacing?: boolean
  onSpawn?: () => boolean
  onProgress?: OnProgress
}

export interface PhysicOptions extends CommonOptions {
  shape?: 'cuboid' | 'ball' | 'cylinder'
}

export interface StatsLike {
  init: (element: HTMLElement) => void
  start: (route: string) => void
  end: (route: string) => void
}

export interface RouteLike {
  query: Record<string, string | undefined>
  name?: string
}

export type LoadProgress = {
  stage: string
  detail?: string
  done: boolean
}

export type OnProgress = (progress: LoadProgress) => void

export interface ToolsConfig {
  stats?: StatsLike
  route?: RouteLike
  canvas: HTMLCanvasElement
  resize?: boolean
  onProgress?: OnProgress
}

export interface EnvironmentLightConfig {
  texture?: string
  intensity?: number
}

export type LightPreset = 'dawn' | 'noon' | 'dusk' | 'night'

export interface LightPresetConfig extends LightsConfig {
  sky?: { color?: number }
}

export interface LightRig {
  sky: { color: number }
  hemisphere: { colors: [number, number]; intensity: number }
  ambient: { color: number; intensity: number }
  directional: { color: number; intensity: number; position: CoordinateTuple }
  environment: { intensity: number }
}

export interface LightsConfig {
  environment?: EnvironmentLightConfig | false
  ambient?: {
    color?: number
    intensity?: number
  }
  directional?: {
    color?: number
    intensity?: number
    position?: CoordinateTuple
    castShadow?: boolean
    shadow?: {
      mapSize?: { width: number; height: number }
      camera?: {
        near?: number
        far?: number
        left?: number
        right?: number
        top?: number
        bottom?: number
      }
      bias?: number
      radius?: number
    }
  }
  hemisphere?: {
    colors?: [number, number]
    intensity?: number
  }
}

export interface PostProcessingConfig {
  pixelate?: {
    size?: number
  }
  bloom?: {
    strength?: number
    threshold?: number
    radius?: number
  }
  fxaa?: Record<string, unknown>
  dotScreen?: {
    scale?: number
    angle?: number
    center?: [number, number]
  }
  rgbShift?: {
    amount?: number
  }
  film?: {
    noiseIntensity?: number
    grayscale?: boolean
  }
  glitch?: Record<string, unknown>
  afterimage?: Record<string, unknown>
  ssao?: Record<string, unknown>
  vignette?: {
    offset?: number
    darkness?: number
    color?: number | [number, number, number]
  }
  colorCorrection?: {
    contrast?: number
    saturation?: number
    brightness?: number
  }
  outline?: {
    color?: number
    strength?: number
    thickness?: number
  }
}

export interface CameraConfig {
  offset?: { x: number; y: number; z: number }
  position?: CoordinateTuple | THREE.Vector3
  fov?: number
  rotation?: CoordinateTuple | THREE.Vector3
  lookAt?: CoordinateTuple | THREE.Vector3 | { x: number; y: number; z: number }
  near?: number
  far?: number
  up?: THREE.Vector3
  aspect?: number
  zoom?: number
  focus?: number
}

export interface GroundConfig {
  size?: number | CoordinateTuple
  color?: number
  texture?: string
  textureRepeat?: [number, number]
  textureOffset?: [number, number]
  restitution?: number
}

export interface SetupConfig {
  global?: {
    frameRate?: number
  }
  scene?: {
    backgroundColor?: number
  }
  camera?: CameraConfig
  ground?: GroundConfig | false
  sky?:
    | {
        texture?: string
        size?: number
        color?: number
      }
    | false
  lights?: LightsConfig | false
  orbit?:
    | {
        target?: THREE.Vector3
        disabled?: boolean
      }
    | false
  postprocessing?: PostProcessingConfig | false
}

export interface InstanceConfig {
  show?: boolean
  amount?: number
  size?: CoordinateTuple
  sizeVariation?: CoordinateTuple
  position?: CoordinateTuple
  positionVariation?: CoordinateTuple
  rotation?: CoordinateTuple
  rotationVariation?: CoordinateTuple
  ratio?: number
  spacing?: number
  opacity?: number
  textures?: {
    random: boolean
    list: string[]
  }
}

export type GeneratedInstanceConfig = Array<{
  position: number[]
  rotation: number[]
  scale: number[]
}>

export interface AreaConfig {
  center?: CoordinateTuple
  size?: CoordinateTuple
  min?: CoordinateTuple
  max?: CoordinateTuple
  count: number
  pattern?: 'random' | 'grid' | 'grid-jitter'
  seed?: number
  sizeVariation?: CoordinateTuple
  rotationVariation?: CoordinateTuple
}

/** Which of the three following cameras is active. */
export type FollowCameraMode = 'third' | 'first' | 'free'

/** Offsets for all three following cameras, plus how long a mode change takes. */
export type FollowCameraConfig = {
  thirdPersonHeight: number
  thirdPersonBack: number
  firstPersonHeight: number
  firstPersonForward: number
  firstPersonLookAhead: number
  freeCamHeight: number
  freeCamBack: number
  transitionSeconds: number
  /**
   * Whether the camera swings round as the target turns, or holds the heading it started from.
   *
   * On suits a chase camera behind a character. Off suits a scene framed from a fixed side: the
   * camera then tracks the target's movement without the shot spinning every time it turns.
   */
  followRotation: boolean
}

/** Where a following camera should sit and what it should look at. */
export type FollowCameraPlacement = {
  position: THREE.Vector3
  lookAt: THREE.Vector3
}

/** Which loader can read a given asset. */
export type AssetParserKind = 'gltf' | 'fbx' | 'texture'

/** Where the loading queue stands, reported as each item completes. */
export type AssetProgress = {
  url: string
  loaded: number
  total: number
  fraction: number
}

/** Notified on every completed item while assets are loading. */
export type AssetProgressListener = (progress: AssetProgress) => void
/** One waypoint on a camera path, with an optional target to keep in view while passing it. */
export type CameraPathPoint = {
  position: CoordinateTuple
  lookAt?: CoordinateTuple
}

/** Where a camera travels, how long it takes, and how it accelerates. */
export type CameraPathOptions = {
  points: readonly CameraPathPoint[]
  seconds: number
  easing?: (t: number) => number
  /**
   * Round the corners through the points, rather than travelling straight between them.
   * Defaults to true; false makes the camera fly the same line the route is drawn as.
   */
  curved?: boolean
  onComplete?: () => void
}

/** A running camera path. `update` returns false once it no longer owns the camera. */
export type CameraPath = {
  update: (deltaSeconds: number) => boolean
  cancel: () => void
}

/**
 * A game object declared once and spawned many times: which model it is, how it is built,
 * and whatever gameplay values belong to it.
 */
export type Prefab = {
  name: string
  model: string
  options?: ModelOptions
  parameters?: Record<string, unknown>
}
