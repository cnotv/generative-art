import type { CoordinateTuple, ModelOptions, SetupConfig } from '@webgamekit/threejs'
import type { ConfigControlsSchema } from '@/stores/viewConfig'
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

/** Behind, above and slightly across, so the river runs away into the haze beside the walker. */
export const CAMERA_OFFSET: CoordinateTuple = [-14, 12, -46]

/** The sun's own offset from the walker: low, and far side from the camera, for a backlit shot. */
export const SUN_OFFSET: CoordinateTuple = [70, 45, 180]

export const setupConfig: SetupConfig = {
  scene: { backgroundColor: 0xb7bda8 },
  // Exponential rather than linear: the ground runs well over a thousand units out, and linear
  // fog reaches full opacity at its far plane and flattens everything past it into one card.
  fog: { color: 0xb7bda8, density: 0.0042 },
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
    color: 0x5c6853,
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
    position: [-14, 19, -346],
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

export const configControls: ConfigControlsSchema = {
  walkSpeed: { label: 'Walk speed', min: 0, max: 25, step: 0.5 }
}
