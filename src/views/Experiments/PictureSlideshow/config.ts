import * as THREE from 'three'
import type { CoordinateTuple, ModelOptions, SetupConfig } from '@webgamekit/threejs'
import type { ControlMapping } from '@webgamekit/controls'
import type { ConfigControlsSchema } from '@/stores/viewConfig'
import concertUrl from '@/assets/images/generic/concert.webp'
import landscapeUrl from '@/assets/images/generic/landscape.webp'
import lightsUrl from '@/assets/images/generic/lights.webp'
import livingRoomUrl from '@/assets/images/generic/livingroom.webp'
import stageUrl from '@/assets/images/generic/stage.webp'
import streetUrl from '@/assets/images/generic/street.webp'
import type { SlideshowTiming } from './types'

/**
 * The pictures the stickman works through, in order.
 *
 * Two is the floor: one is leaving and one is arriving. Any more simply gives
 * the slideshow somewhere further to go.
 */
export const PICTURES: { name: string; url: string }[] = [
  { name: 'landscape', url: landscapeUrl },
  { name: 'street', url: streetUrl },
  { name: 'concert', url: concertUrl },
  { name: 'stage', url: stageUrl },
  { name: 'lights', url: lightsUrl },
  { name: 'living room', url: livingRoomUrl }
]

/** Roughly the middle of the picture, so it is the subject rather than the plinth. */
const VIEW_TARGET: CoordinateTuple = [0, 1.7, 0]

export const SETUP_CONFIG: SetupConfig = {
  scene: { backgroundColor: 0xd7d9e4 },
  camera: { position: [0, 2.3, 8.2], fov: 50, lookAt: VIEW_TARGET },
  // An orbit drag and a swipe are the same gesture, and the swipe is the one
  // this scene is driven by, so the camera stays where it was composed. The
  // target still has to be set: disabled or not, orbit aims the camera at it,
  // and `camera.lookAt` above is overwritten on the first update.
  orbit: { target: new THREE.Vector3(...VIEW_TARGET), disabled: true },
  // A released picture has to keep going once it leaves, so there is nothing
  // for it to land on and no floor for it to clip through.
  ground: false,
  sky: false,
  lights: {
    ambient: { color: 0xf3eee8, intensity: 1 },
    directional: {
      color: 0xfff6e8,
      intensity: 2.6,
      position: [9, 16, 11],
      castShadow: true,
      shadow: { radius: 3, bias: -0.0004 }
    }
  }
}

/** The stand the stickman works on, wide enough to read as a base and no wider. */
export const PLINTH_RADIUS = 2.2
export const PLINTH: ModelOptions = {
  name: 'plinth',
  size: [PLINTH_RADIUS * 2, 1, PLINTH_RADIUS * 2],
  position: [0, -1, 0],
  color: 0xb9ae9f,
  roughness: 0.95,
  metalness: 0,
  type: 'fixed',
  hasGravity: false
}

export const STICKMAN_MODEL_PATH = 'stickboy.glb'
/** Stands the rig 4.7 units tall, which the poses below are measured against. */
export const STICKMAN_SCALE = 3.5
export const STICKMAN_YAW = Math.PI
/** How far the rig turns after the picture it is sending away, at the peak of a change. */
export const STICKMAN_YAW_SWING = 0.22

/**
 * The arm pose, as a pitch forward and a roll outwards.
 *
 * The rig's shoulders sit 1.05 either side of centre with 1.33 of arm below
 * them, so pitch alone can only ever put the hands 2.1 apart — narrower than a
 * picture worth looking at, which would bury them behind it. Rolling the arms
 * out as well swings each hand wide of its own shoulder, and the two together
 * put the hands past the picture's edges where they can be seen holding it.
 */
export const ARM_PITCH_DOWN = -0.55
export const ARM_PITCH_UP = -1.6
export const ARM_ROLL_DOWN = 0.1
export const ARM_ROLL_UP = 0.95

export const CANVAS_SIZE: CoordinateTuple = [2.9, 2.05, 0.12]
export const CANVAS_MATERIAL: ModelOptions = {
  roughness: 0.85,
  metalness: 0,
  type: 'fixed',
  hasGravity: false
}

/**
 * Where a picture sits once it is up, and where the next one comes from.
 *
 * The hands settle at (±2, 2.66, 0.93), so the picture is hung at their height
 * and only just in front of them. Depth matters more than it looks: perspective
 * magnifies whatever is nearer the camera, so a picture held further forward
 * than the hands outgrows them on screen and swallows its own grip however wide
 * the arms are spread. At the same depth, the margin drawn is the margin built.
 * A picture enters from the side opposite the one leaving, far enough out to be
 * off camera before it starts.
 */
export const CANVAS_DISPLAY_POSITION: CoordinateTuple = [0, 2.66, 0.48]
export const CANVAS_DISPLAY_ROTATION: CoordinateTuple = [0, 0, 0]
export const CANVAS_ENTRY_DISTANCE = 9
export const CANVAS_ENTRY_DROP = 0.6

/**
 * How the released picture leaves.
 *
 * Sideways is what keeps it off the plinth: it has cleared the base well before
 * it has fallen as far as the top. The drop and the tumble are what stop the
 * exit reading as a slide along a rail.
 */
export const EXIT_DISTANCE = 11
export const EXIT_DROP = 5
export const EXIT_SPIN = 3.4

export const DEFAULT_TIMING: SlideshowTiming = { hold: 4, release: 0.85, arrive: 0.95 }

/** Right advances, left goes back, by tap or swipe alike. Arrow keys do the same on a desktop. */
export const CONTROL_MAPPING: ControlMapping = {
  pointer: {
    'tap-right': 'next',
    'swipe-right': 'next',
    'tap-left': 'previous',
    'swipe-left': 'previous'
  },
  keyboard: { ArrowRight: 'next', ArrowLeft: 'previous' },
  gamepad: { 'dpad-right': 'next', 'dpad-left': 'previous' }
}

export const configControls: ConfigControlsSchema = {
  timing: {
    hold: { label: 'Hold', min: 1, max: 20, step: 0.5 },
    release: { label: 'Release', min: 0.3, max: 3, step: 0.05 },
    arrive: { label: 'Arrive', min: 0.3, max: 3, step: 0.05 }
  },
  exit: {
    distance: { label: 'Throw distance', min: 4, max: 20, step: 0.5 },
    drop: { label: 'Throw drop', min: 0, max: 12, step: 0.5 },
    spin: { label: 'Tumble', min: 0, max: 10, step: 0.1 }
  },
  arms: {
    pitchUp: { label: 'Arms raised', min: -3, max: 0, step: 0.05 },
    rollUp: { label: 'Arms spread', min: 0, max: 1.2, step: 0.02 }
  }
}

/** Named rather than a bare index, since the yaw swing turns about it every frame. */
export const UP_AXIS = new THREE.Vector3(0, 1, 0)
