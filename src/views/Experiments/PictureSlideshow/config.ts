import * as THREE from 'three'
import type { CoordinateTuple, ModelOptions, SetupConfig } from '@webgamekit/threejs'
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
 * Three is the floor: one is held, one waits on the plinth and one is still
 * falling out of frame, so a shorter list would ask a single canvas to be in
 * two places at once.
 */
export const PICTURES: { name: string; url: string }[] = [
  { name: 'landscape', url: landscapeUrl },
  { name: 'street', url: streetUrl },
  { name: 'concert', url: concertUrl },
  { name: 'stage', url: stageUrl },
  { name: 'lights', url: lightsUrl },
  { name: 'living room', url: livingRoomUrl }
]

/** Roughly chest height on the rig, so the whole piece is framed rather than the plinth. */
const VIEW_TARGET: CoordinateTuple = [0, 2.1, 0]

export const SETUP_CONFIG: SetupConfig = {
  scene: { backgroundColor: 0xd7d9e4 },
  camera: { position: [0, 2.9, 11], fov: 50, lookAt: VIEW_TARGET },
  orbit: { target: new THREE.Vector3(...VIEW_TARGET) },
  // The released canvas has to keep going after it leaves the plinth, so there
  // is nothing for it to land on and no floor for it to clip through.
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

/**
 * The stand the stickman works on, sized so a dropped canvas clears its front
 * edge before it has fallen as far as the top.
 */
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

/**
 * Arm pitch with the hands down on the waiting canvas, and out at display height.
 *
 * The rig's shoulders sit at y 2.66 with 1.33 of arm below them, so the raised
 * pose is a little past horizontal and the lowered one reaches forward and down
 * onto the canvas standing at its feet.
 */
export const ARM_PITCH_DOWN = -0.6
export const ARM_PITCH_UP = -1.6

export const CANVAS_SIZE: CoordinateTuple = [2, 1.45, 0.1]
export const CANVAS_MATERIAL: ModelOptions = {
  roughness: 0.85,
  metalness: 0,
  type: 'fixed',
  hasGravity: false
}

/**
 * Where a canvas sits once it is up, and where it stands while it waits its turn.
 *
 * Display sits just beyond the raised hands at z 1.33, so the hands read as
 * behind it rather than through it. Waiting stands on the plinth top at y 0,
 * far enough forward to clear the rig's own legs.
 */
export const CANVAS_DISPLAY_POSITION: CoordinateTuple = [0, 2.75, 1.45]
export const CANVAS_DISPLAY_ROTATION: CoordinateTuple = [0, 0, 0]
export const CANVAS_WAITING_POSITION: CoordinateTuple = [0, CANVAS_SIZE[1] / 2, 0.75]
export const CANVAS_WAITING_ROTATION: CoordinateTuple = [-0.22, 0, 0]

/**
 * How the released canvas leaves.
 *
 * The forward drift is what keeps it off the plinth: without it the canvas
 * falls straight through the top the stickman is standing on. At this rate it
 * has cleared the front edge before it reaches plinth height.
 */
export const FALL_GRAVITY = 13
export const FALL_DRIFT = 3
export const FALL_SPIN = 2.2
/** Below this the canvas is out of shot, so it can be parked until its next turn. */
export const FALL_HIDE_BELOW = -14

export const DEFAULT_TIMING: SlideshowTiming = { hold: 3.2, drop: 1, lift: 1.1 }

export const configControls: ConfigControlsSchema = {
  timing: {
    hold: { label: 'Hold', min: 0.5, max: 8, step: 0.1 },
    drop: { label: 'Drop', min: 0.3, max: 4, step: 0.1 },
    lift: { label: 'Lift', min: 0.3, max: 4, step: 0.1 }
  },
  fall: {
    gravity: { label: 'Fall speed', min: 4, max: 30, step: 0.5 },
    drift: { label: 'Toss forward', min: 0, max: 12, step: 0.5 },
    spin: { label: 'Tumble', min: 0, max: 10, step: 0.1 }
  },
  arms: {
    pitchUp: { label: 'Arms raised', min: -3, max: 0, step: 0.05 },
    pitchDown: { label: 'Arms lowered', min: -2, max: 1.5, step: 0.05 }
  }
}
