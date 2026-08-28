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

/**
 * Where the camera is aimed, which is what decides how much of the rig is in shot.
 *
 * The rig's legs reach the hip at 3.2, and the frame's lower edge lands at 1.58 from here, so
 * the character stands half out of the bottom of the picture rather than on anything. That
 * is the whole floor: with nothing under him there is nothing for a thrown picture to land
 * on either.
 */
const VIEW_TARGET: CoordinateTuple = [0, 4.1, 0]

export const SETUP_CONFIG: SetupConfig = {
  scene: { backgroundColor: 0xd7d9e4 },
  camera: { position: [0, 4.1, 5.4], fov: 50, lookAt: VIEW_TARGET },
  // An orbit drag and a swipe are the same gesture, and the swipe is the one
  // this scene is driven by, so the camera stays where it was composed. The
  // target still has to be set: disabled or not, orbit aims the camera at it,
  // and `camera.lookAt` above is overwritten on the first update.
  orbit: { target: new THREE.Vector3(...VIEW_TARGET), disabled: true },
  // A released picture has to keep going once it leaves, so there is no floor
  // for it to land on or clip through.
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

export const CHARACTER_MODEL_PATH = 'mixamoYBot.fbx'
/** The Mixamo rig is authored 180 units tall; this stands it 5.8 units tall here. */
export const CHARACTER_SCALE = 0.032
/** The rig is modelled facing the camera already, so it needs no turn. */
export const CHARACTER_YAW = 0
/** Warm off-white, so the rig sits in the same pastel range as the background. */
export const CHARACTER_COLOR = 0xe4ddd2

/**
 * The gesture the character plays, authored against this skeleton by
 * `scripts/generate-present-animation.mjs` and written as a bare clip.
 */
export const CHARACTER_ANIMATION = 'animations/present.json'

/** The picture hangs between these two, so it goes wherever the clip puts them. */
export const CHARACTER_HAND_BONES = ['mixamorigLeftHand', 'mixamorigRightHand']

export const CANVAS_SIZE: CoordinateTuple = [2.6, 1.85, 0.12]
export const CANVAS_MATERIAL: ModelOptions = {
  roughness: 0.85,
  metalness: 0,
  type: 'fixed',
  hasGravity: false
}

/**
 * How the picture sits relative to the hands, and where the next one comes from.
 *
 * The picture is hung on the midpoint of the two hands rather than at a fixed
 * spot, so it goes wherever the clip puts them. It is nudged forward of that
 * midpoint by just enough that the palms sit behind the board and only the
 * outer edge of each hand shows past its sides. A picture enters from the side
 * opposite the one leaving, far enough out to be off camera before it starts.
 */
export const CANVAS_HAND_OFFSET_Z = 0.14
export const CANVAS_DISPLAY_ROTATION: CoordinateTuple = [0, 0, 0]
export const CANVAS_ENTRY_DISTANCE = 9
export const CANVAS_ENTRY_DROP = 0.6

/**
 * How the released picture leaves.
 *
 * Sideways is what carries it out of shot, and it has left the frame long before
 * the drop matters. The drop and the tumble are what stop the exit reading as a
 * slide along a rail.
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
  }
}
