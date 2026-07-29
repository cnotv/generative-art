import { reactive } from 'vue'
import { useDebugSceneStore } from '@/stores/debugScene'
import type { RunCameraConfig } from './types'
import {
  CHASE_BACK,
  CAMERA_ELEMENT_NAME,
  CHASE_HEIGHT,
  CAMERA_TRANSITION_SECONDS,
  FIRST_PERSON_FORWARD,
  FIRST_PERSON_HEIGHT,
  FIRST_PERSON_LOOK_AHEAD,
  FREE_CAM_BACK,
  FREE_CAM_HEIGHT
} from './config'

/**
 * How the three cameras follow the rock, grouped by the mode each belongs to.
 *
 * Separate from the shared camera row, which owns lens and projection — field of
 * view, near and far, the camera's own transform. These are the follow offsets,
 * which are a property of the game rather than of the camera.
 */
export const RR_CAMERA_CONTROLS = {
  thirdPersonHeight: { min: 1, max: 80, step: 0.5, label: 'Chase: height' },
  thirdPersonBack: { min: 1, max: 120, step: 0.5, label: 'Chase: distance behind' },
  // Measured from the rock's centre, which already sits a radius above the deck.
  // The first-person view is level rather than angled down, so this is the only
  // thing setting how much of the path ahead is visible.
  firstPersonHeight: { min: 0, max: 20, step: 0.1, label: 'First: eye height', sectionStart: true },
  // Far enough forward and the ball falls entirely behind the camera, which is
  // what keeps a player from seeing their own body.
  firstPersonForward: { min: 0, max: 20, step: 0.1, label: 'First: eye forward' },
  firstPersonLookAhead: { min: 1, max: 200, step: 1, label: 'First: looks ahead' },
  freeCamHeight: { min: 1, max: 300, step: 1, label: 'Free: height', sectionStart: true },
  freeCamBack: { min: 1, max: 300, step: 1, label: 'Free: distance behind' },
  transitionSeconds: { min: 0, max: 3, step: 0.05, label: 'Mode change time', sectionStart: true }
}

/** The shipped offsets, and the fallback before the panel has registered. */
export const DEFAULT_RUN_CAMERA: RunCameraConfig = {
  thirdPersonHeight: CHASE_HEIGHT,
  thirdPersonBack: CHASE_BACK,
  firstPersonHeight: FIRST_PERSON_HEIGHT,
  firstPersonForward: FIRST_PERSON_FORWARD,
  firstPersonLookAhead: FIRST_PERSON_LOOK_AHEAD,
  freeCamHeight: FREE_CAM_HEIGHT,
  freeCamBack: FREE_CAM_BACK,
  transitionSeconds: CAMERA_TRANSITION_SECONDS
}

export type CameraPanel = {
  config: RunCameraConfig
  teardown: () => void
}

/**
 * Registers the run's camera offsets in the elements panel.
 *
 * Nothing is pushed anywhere on change: the camera is placed from these values
 * every frame, so editing one is felt on the next.
 *
 * @returns The shared config the run loop reads, and a teardown
 */
export const registerCameraElements = (): CameraPanel => {
  const debugSceneStore = useDebugSceneStore()
  const config = reactive<RunCameraConfig>({ ...DEFAULT_RUN_CAMERA })

  debugSceneStore.addSceneElement(
    // The type deliberately avoids the word Camera. The elements panel routes
    // any type containing it to the shared camera component, which renders lens
    // and projection instead of whatever schema the element carries — so a row
    // typed "Camera" here would show the wrong controls entirely. The label is
    // free to say what it is.
    { name: CAMERA_ELEMENT_NAME, type: 'Rig', label: 'Run camera', hidden: false },
    {
      title: 'Run camera',
      type: 'Rig',
      schema: RR_CAMERA_CONTROLS,
      getValue: (path: string) => config[path as keyof RunCameraConfig],
      updateValue: (path: string, value: unknown) => {
        config[path as keyof RunCameraConfig] = value as number
      }
    }
  )

  return {
    config,
    teardown: () => debugSceneStore.removeSceneElement(CAMERA_ELEMENT_NAME)
  }
}
