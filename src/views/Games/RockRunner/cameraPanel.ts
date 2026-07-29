import { reactive, watch, type Ref } from 'vue'
import { useDebugSceneStore } from '@/stores/debugScene'
import { useElementPropertiesStore } from '@/stores/elementProperties'
import type { CameraMode, RunCameraConfig } from './types'
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
const MODE_SELECTOR = {
  mode: {
    component: 'ButtonSelector',
    label: 'Camera',
    options: [
      { value: 'third', label: 'Chase' },
      { value: 'first', label: 'First' },
      { value: 'free', label: 'Free' }
    ]
  }
}

const SHARED_CONTROLS = {
  transitionSeconds: { min: 0, max: 3, step: 0.05, label: 'Mode change time', sectionStart: true }
}

/**
 * The offsets belonging to each mode, shown only while that mode is selected.
 *
 * All eight at once was a wall of sliders of which two thirds described cameras
 * the player was not looking through, and no way to tell which two mattered.
 */
export const RR_CAMERA_MODE_CONTROLS = {
  third: {
    thirdPersonHeight: { min: 1, max: 80, step: 0.5, label: 'Height' },
    thirdPersonBack: { min: 1, max: 120, step: 0.5, label: 'Distance behind' }
  },
  first: {
    // Measured from the rock's centre, which already sits a radius above the
    // deck. The view is level rather than angled down, so this is the only
    // thing setting how much of the path ahead is visible.
    firstPersonHeight: { min: 0, max: 20, step: 0.1, label: 'Eye height' },
    // Far enough forward and the ball falls entirely behind the camera, which
    // is what keeps a player from seeing their own body.
    firstPersonForward: { min: 0, max: 20, step: 0.1, label: 'Eye forward' },
    firstPersonLookAhead: { min: 1, max: 200, step: 1, label: 'Looks ahead' }
  },
  free: {
    freeCamHeight: { min: 1, max: 300, step: 1, label: 'Height' },
    freeCamBack: { min: 1, max: 300, step: 1, label: 'Distance behind' }
  }
}

/**
 * The schema shown for one camera mode: the selector, that mode's own offsets,
 * and the settings every mode shares.
 *
 * @param mode - The camera currently selected
 * @returns The controls to render for it
 */
export const cameraSchemaFor = (mode: CameraMode) => ({
  ...MODE_SELECTOR,
  ...RR_CAMERA_MODE_CONTROLS[mode],
  ...SHARED_CONTROLS
})

/** Every control across every mode, which is what the config object must cover. */
export const RR_CAMERA_CONTROLS = {
  ...RR_CAMERA_MODE_CONTROLS.third,
  ...RR_CAMERA_MODE_CONTROLS.first,
  ...RR_CAMERA_MODE_CONTROLS.free,
  ...SHARED_CONTROLS
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

export type CameraPanelOptions = {
  /** The camera the run is currently using, so the tabs follow the C key too. */
  mode: Ref<CameraMode>
  setMode: (mode: CameraMode) => void
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
export const registerCameraElements = (options: CameraPanelOptions): CameraPanel => {
  const debugSceneStore = useDebugSceneStore()
  const config = reactive<RunCameraConfig>({ ...DEFAULT_RUN_CAMERA })

  const properties = (mode: CameraMode) => ({
    title: 'Run camera',
    type: 'Rig',
    schema: cameraSchemaFor(mode),
    getValue: (path: string) =>
      path === 'mode' ? options.mode.value : config[path as keyof RunCameraConfig],
    updateValue: (path: string, value: unknown) => {
      // Selecting a tab switches the camera as well as the controls: a player
      // tuning a mode wants to be looking through it.
      if (path === 'mode') {
        options.setMode(value as CameraMode)
        return
      }
      config[path as keyof RunCameraConfig] = value as number
    }
  })

  // The type deliberately avoids the word Camera. The elements panel routes
  // any type containing it to the shared camera component, which renders lens
  // and projection instead of whatever schema the element carries — so a row
  // typed "Camera" here would show the wrong controls entirely. The label is
  // free to say what it is.
  debugSceneStore.addSceneElement(
    { name: CAMERA_ELEMENT_NAME, type: 'Rig', label: 'Run camera', hidden: false },
    properties(options.mode.value)
  )

  // Re-registered rather than filtered in the panel, and watched rather than
  // set on click, so cycling the camera with the keyboard moves the tabs too.
  const stop = watch(options.mode, (mode) => {
    useElementPropertiesStore().registerElementProperties(CAMERA_ELEMENT_NAME, properties(mode))
  })

  return {
    config,
    teardown: () => {
      stop()
      debugSceneStore.removeSceneElement(CAMERA_ELEMENT_NAME)
    }
  }
}
