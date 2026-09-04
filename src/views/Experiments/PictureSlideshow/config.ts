import type { CoordinateTuple, SetupConfig } from '@webgamekit/threejs'
import type { ControlMapping } from '@webgamekit/controls'
import type { ConfigControlsSchema } from '@/stores/viewConfig'
import backdropUrl from '@/assets/images/backgrounds/field.webp'
import hopsUrl from '@/assets/images/slideshow/hops.webp'
import butterflyUrl from '@/assets/images/slideshow/butterfly.webp'
import autumnLeavesUrl from '@/assets/images/slideshow/autumn-leaves.webp'
import type { SlideshowTiming } from './types'

/**
 * Every picture the slideshow can show. The board itself is a DOM `<img>` rather than a
 * textured mesh, so a picture is only ever a URL: nothing here is spawned in the scene, and
 * any number is fine. The Config panel's uploader can still override every slot at once with
 * a single custom image, after which every change keeps showing that one instead.
 *
 * Every image here is prepped before it lands in this list: flattened onto an opaque white
 * background (a transparent source would otherwise show whatever page or panel sits behind
 * the overlay) and cover-fit to `CANVAS_SIZE`'s own 2.0 x 1.45 aspect (1000 x 725px),
 * cropping whichever side overflows rather than stretching it.
 */
export const PICTURES: { name: string; url: string }[] = [
  { name: 'hops', url: hopsUrl },
  { name: 'butterfly', url: butterflyUrl },
  { name: 'autumn-leaves', url: autumnLeavesUrl }
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

/** Behind the canvas as a CSS layer, per `SETUP_CONFIG.scene.transparent` below. */
export const BACKDROP_URL = backdropUrl

export const SETUP_CONFIG: SetupConfig = {
  // The backdrop photo is a CSS layer behind the canvas instead, so its blur can be a
  // panel slider rather than baked into the image at build time.
  scene: { transparent: true },
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
 * The shoulders alone are already wider than `CANVAS_SIZE`'s current width, so
 * this rig's hands sit outside the picture at any roll from here up — the roll
 * only decides by how much, not whether.
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
export const ARM_ROLL_UP = 0.2

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
 * A pose-keyframe export from the Rig Animator tool, not a bare `AnimationClip` `getAnimations`
 * reads directly — built into a clip at load time instead. Its own hold-to-hold round trip:
 * holding, dropping, picking the next one up, holding again. Played once, start to finish, the
 * instant a click or swipe starts a change; frozen on its opening frame the rest of the time.
 */
export const MIXAMO_HOLD_ANIMATION = 'animations/hold-to-hold.json'
/** The picture hangs between these two, so it goes wherever the clip puts them. */
export const MIXAMO_HAND_BONES = ['mixamorigLeftHand', 'mixamorigRightHand']

/** The one character that is not a cut-out skin; `character.ts` lists the rest. */
export const MIXAMO_CHARACTER = 'mixamo'
export const MIXAMO_CHARACTER_LABEL = 'Mixamo (animated)'
export const CUT_OUT_LABEL_PREFIX = 'Cut-out'
export const DEFAULT_CHARACTER = MIXAMO_CHARACTER

/** The picture's own width and height, in world units; DOM overlay sizing is projected from this. */
export const CANVAS_SIZE: CoordinateTuple = [2.0, 1.45, 0.12]

/**
 * Where a picture sits once it is up, and where the next one comes from.
 *
 * `standByHands` stands each rig so its hands land at this height regardless of the
 * rig's own proportions, and `CANVAS_SIZE`'s width is what the hold pose's own hand
 * spread was tuned against — the two have to be retuned together. Depth matters more
 * than it looks: perspective magnifies whatever is nearer the camera, so a picture held
 * further forward than the hands outgrows them on screen and swallows its own grip
 * however wide the arms are spread. At the same depth, the margin drawn is the margin
 * built.
 */
export const CANVAS_DISPLAY_POSITION: CoordinateTuple = [0, 2.66, 0.65]
export const CANVAS_DISPLAY_ROTATION: CoordinateTuple = [0, 0, 0]

/**
 * Nudged towards the camera on top of wherever the hands actually are, since only the
 * Mixamo rig's own clip decides that depth and this is the one place left to correct it
 * without re-authoring the clip. Editable live from the Elements panel; this is only
 * where it starts.
 */
export const DEFAULT_HELD_OFFSET: CoordinateTuple = [0, 0, 0.5]

/**
 * Hand-tuned against the hold-to-hold clip's own drop and pick motion: release gives the
 * drop room to read before the picture is gone, arrive settles quickly once the new one
 * is already in view, and the fade itself only runs across the back half of the release
 * rather than the whole thing, so the picture stays solid while the hands are still
 * clearly carrying it away.
 */
export const DEFAULT_TIMING: SlideshowTiming = {
  hold: 5,
  release: 0.9,
  arrive: 0.5,
  fadeStart: 0.3,
  fadeEnd: 0.45
}

/** How much the backdrop photo is blurred, in CSS pixels. */
export const DEFAULT_BACKGROUND_BLUR = 20

/**
 * Right or down advances, left goes back, by tap or swipe alike. Arrow keys do the same on
 * a desktop. Down rather than up for advancing: it reads as pulling the current picture away
 * to reveal the next one, the same motion a swipe-right pulls it aside with.
 */
export const CONTROL_MAPPING: ControlMapping = {
  pointer: {
    'tap-right': 'next',
    'swipe-right': 'next',
    'swipe-down': 'next',
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
    arrive: { label: 'Arrive', min: 0.3, max: 3, step: 0.05 },
    fadeStart: { label: 'Fade start', min: 0, max: 1, step: 0.05 },
    fadeEnd: { label: 'Fade end', min: 0, max: 1, step: 0.05 }
  },
  background: {
    blur: { label: 'Backdrop blur', min: 0, max: 40, step: 1 }
  },
  image: { file: 'image/*', label: 'Load a picture' }
}
