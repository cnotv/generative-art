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
 * The rig's legs run from 0 to 1.82, and the frame's lower edge lands at 0.88 from here, so
 * the character stands half out of the bottom of the picture rather than on anything. That
 * is the whole floor: with nothing under him there is nothing for a thrown picture to land
 * on either.
 */
export const VIEW_TARGET: CoordinateTuple = [0, 3.3, 0]

export const SETUP_CONFIG: SetupConfig = {
  scene: { backgroundColor: 0xd7d9e4 },
  camera: { position: [0, 3.3, 5.2], fov: 50, lookAt: VIEW_TARGET },
  // An orbit drag and a swipe are the same gesture, and the swipe is the one
  // this scene is driven by, so the camera stays where it was composed. The
  // target still has to be set: disabled or not, orbit aims the camera at it,
  // and `camera.lookAt` above is overwritten on the first update.
  orbit: { disabled: true },
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

export const STICKMAN_MODEL_PATH = 'stickboy.glb'
/** Stands the cut-out rig 4.7 units tall, which the arm poses below are measured against. */
export const STICKMAN_SCALE = 3.5
/**
 * The rig faces the camera at zero.
 *
 * It was turned by half a circle here for a long time, on the assumption that its
 * own zero faced away. The arms were then pitched towards the camera to hold the
 * picture, which is the body's back — so it presented the picture over its own
 * shoulders. The picture has to be on the camera's side, so the body must be too.
 */
export const STICKMAN_YAW = 0

/**
 * The illustration the rig wears, from the shared skin catalogue.
 *
 * The rig is a flat cut-out, so a character drawing projected onto it reads as
 * that character rather than as a texture on a mannequin. Alpha-tested rather
 * than blended, and still writing depth: a cutout is opaque or discarded per
 * pixel, so it should occlude like any solid.
 */
export const STICKMAN_TEXTURE_ALPHA_TEST = 0.5

/**
 * The arm pose, as a pitch forward and a roll outwards.
 *
 * The rig's shoulders sit 1.05 either side of centre with only 0.53 of arm
 * beyond them, so pitch alone can never hold the hands wider than the shoulders
 * — narrower than a picture worth looking at, which would bury them behind it.
 * Rolling the arms out as well swings each hand wide of its own shoulder, and
 * the two together put the hands past the picture's edges.
 *
 * The pitch is positive because the rig's front is its local +z. A negative
 * pitch swings the arms behind the body, which still puts the hands on the
 * camera's side if the body is turned away — the picture then looks held, and
 * is in fact being presented over the character's own shoulders.
 *
 * It is also small. The picture sits barely half a unit in front of the body,
 * so the arms need almost no forward travel to reach behind it, and a cut-out
 * arm swung far forward turns its edge to the camera and reads as a spike. Held
 * near horizontal, the arm keeps its painted face towards the viewer.
 */
export const ARM_PITCH_DOWN = 0.15
export const ARM_PITCH_UP = 0.35
export const ARM_ROLL_DOWN = 0.1
export const ARM_ROLL_UP = 0.95

export const MIXAMO_MODEL_PATH = 'character2.fbx'
/**
 * Scaled so its hands land as far apart as the cut-out rig's, not so the two
 * are the same height. The rig is authored 166 units tall, so this stands it 6.3.
 *
 * The picture is sized to a hand span, so matching spans is what lets both
 * characters hold the same board and share one camera. Their proportions differ,
 * so matching the span leaves the Mixamo rig taller — which is why it is stood
 * by its hands rather than its feet, below.
 */
export const MIXAMO_SCALE = 0.038
/**
 * The gestures authored against this skeleton by `scripts/generate-slideshow-gestures.mjs`:
 * the looping idle held while a picture is on display, and one one-shot push per throw
 * direction, scrubbed forward through release and backward through arrive.
 */
export const MIXAMO_HOLD_ANIMATION = 'animations/hold.json'
export const MIXAMO_PUSH_RIGHT_ANIMATION = 'animations/push-right.json'
export const MIXAMO_PUSH_LEFT_ANIMATION = 'animations/push-left.json'
/** The picture hangs between these two, so it goes wherever the clip puts them. */
export const MIXAMO_HAND_BONES = ['mixamorigLeftHand', 'mixamorigRightHand']

/** The one character that is not a cut-out skin; `character.ts` lists the rest. */
export const MIXAMO_CHARACTER = 'mixamo'
export const MIXAMO_CHARACTER_LABEL = 'Mixamo (animated)'
export const CUT_OUT_LABEL_PREFIX = 'Cut-out'
export const DEFAULT_CHARACTER = MIXAMO_CHARACTER

export const CANVAS_SIZE: CoordinateTuple = [2.6, 1.85, 0.12]
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
 */
export const CANVAS_DISPLAY_POSITION: CoordinateTuple = [0, 2.66, 0.48]
export const CANVAS_DISPLAY_ROTATION: CoordinateTuple = [0, 0, 0]

/**
 * How the released picture leaves, and the arriving one is drawn arriving: the same
 * distance, drop and tumble, run in reverse from the opposite side, since an entrance
 * is a mirror of an exit rather than a separately authored effect.
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
