import type { CoordinateTuple, ModelOptions, SetupConfig } from '@webgamekit/threejs'
import type { ConfigControlsSchema } from '@/stores/viewConfig'
import type { PlantingBand } from './types'
import terrainTextureImage from '@/assets/images/textures/terrain.jpg'

/** Where the walk loop begins and ends on Z. The walker travels away from the camera. */
export const WALK_START_Z = -300
export const WALK_END_Z = 300

/** Default travel speed, in world units per second, matched by eye to the walk cycle. */
export const DEFAULT_WALK_SPEED = 9

export const WALK_ANIMATION = 'walk2'

/**
 * The rig is authored around two hundred units tall, and the scene is built for a walker of
 * about fifteen, the scale the other Mixamo views here already frame for.
 */
export const characterOptions: ModelOptions = {
  name: 'walker',
  position: [0, -1, -300] as CoordinateTuple,
  rotation: [0, 0, 0] as CoordinateTuple,
  scale: [0.15, 0.15, 0.15] as CoordinateTuple,
  type: 'fixed',
  hasGravity: false,
  castShadow: true,
  material: 'MeshLambertMaterial',
  color: 0xd9cfc0,
  animations: ['animations/walk2.fbx']
}

/**
 * Behind and well out to the bank side, so the shot looks diagonally across the water rather
 * than straight down it. Directly behind her the river is squeezed into one edge of the frame.
 */
export const CAMERA_OFFSET: CoordinateTuple = [-40, 11, -38]

/** The sun's own offset from the walker: low, and far side from the camera, for a backlit shot. */
export const SUN_OFFSET: CoordinateTuple = [70, 45, 180]

export const setupConfig: SetupConfig = {
  scene: { backgroundColor: 0xb7bda8 },
  // Exponential rather than linear: the ground runs well over a thousand units out, and linear
  // fog reaches full opacity at its far plane and flattens everything past it into one card.
  fog: { color: 0xb7bda8, density: 0.0026 },
  ground: {
    size: [1400, 0.01, 1400],
    position: [0, -1, 0],
    color: 0xa89a82,
    texture: terrainTextureImage,
    textureRepeat: [80, 80]
  },
  // The surface sits above the mud rather than in a channel cut through it. The reference is a
  // flooded wetland, where the level has risen over the bank and there is no bank left to see.
  water: {
    size: [90, 1400],
    position: [39, -0.8, 0],
    color: 0x545f48,
    rippleStrength: 0.02,
    rippleScale: 60,
    rippleSpeed: 0.35
  },
  // The haze already closes the horizon, so a sky dome would only add a seam where the two
  // colours meet.
  sky: false,
  lights: {
    ambient: { color: 0xc3cbb4, intensity: 1.4 },
    hemisphere: { colors: [0xc9cfb4, 0x6a6a52], intensity: 0.9 },
    directional: {
      color: 0xffe2b8,
      intensity: 2.6,
      position: [70, 45, -120],
      castShadow: true
    },
    environment: false
  },
  camera: {
    position: [-40, 18, -338],
    lookAt: [0, 7, -300],
    fov: 62,
    near: 0.5,
    far: 2000
  },
  // No orbit at all, rather than a disabled one: orbit aims the camera at its own target on
  // every update even when disabled, which would fight the tracking shot's `lookAt` each frame.
  orbit: false,
  // No post-processing: the composer has no OutputPass, so it writes linear colour straight to
  // an sRGB framebuffer and every effect costs the scene most of its light. The haze is doing
  // the work a bloom would have done anyway.
  postprocessing: false
}

export const FOREST_MODEL = 'tree.glb'

/**
 * Bark, bark, and four canopy layers, in the order `tree.glb` lists its meshes. The model
 * ships in saturated nursery greens, which read as placeholder art beside everything else here.
 */
export const FOREST_COLORS = [0x574b3e, 0x574b3e, 0x6b7a55, 0x7d8a62, 0x5e6d4b, 0x88936d]

/**
 * The two bark meshes of `tree.glb`, by the names its export gave them. Undergrowth is the same
 * model with these dropped: a bush is a canopy sitting on the ground with no trunk under it, and
 * the trunk carries 5276 of the model's 5370 triangles, which is a great deal to spend on
 * something knee high.
 */
export const FOREST_TRUNK_PARTS = ['Object_4', 'Object_6']

/**
 * Nothing is planted within eight units of x = 0, which is the line the walker travels, and the
 * near bank keeps clear of the camera's own track as well so no trunk swings through the lens.
 */
export const TREE_BANDS: PlantingBand[] = [
  {
    name: 'far-bank',
    min: [100, 0, -700],
    max: [430, 0, 700],
    count: 22,
    rootLevel: -1,
    minScale: 3,
    maxScale: 5.5,
    seed: 11
  },
  {
    name: 'standing-in-the-river',
    min: [10, 0, -700],
    max: [78, 0, 700],
    count: 30,
    rootLevel: -1,
    minScale: 2.6,
    maxScale: 4.8,
    seed: 23
  },
  {
    name: 'near-bank',
    min: [-340, 0, -700],
    max: [-78, 0, 700],
    count: 14,
    rootLevel: -1,
    minScale: 3,
    maxScale: 5.5,
    seed: 37
  }
]

/** Costs almost nothing per copy, so it runs dense enough to break the waterline's straight cut. */
export const UNDERGROWTH_BANDS: PlantingBand[] = [
  {
    name: 'undergrowth-waterside',
    min: [-4, 0, -700],
    max: [34, 0, 700],
    count: 70,
    rootLevel: -1,
    minScale: 0.25,
    maxScale: 0.7,
    seed: 53
  },
  {
    name: 'undergrowth-bankside',
    min: [-190, 0, -700],
    max: [-8, 0, 700],
    count: 170,
    rootLevel: -1,
    minScale: 0.25,
    maxScale: 0.7,
    seed: 71
  }
]

export const configControls: ConfigControlsSchema = {
  walkSpeed: { label: 'Walk speed', min: 0, max: 25, step: 0.5 }
}
