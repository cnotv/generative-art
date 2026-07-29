import { reactive, watch, type Ref } from 'vue'
import {
  DEFAULT_FOLLOW_CAMERA,
  followCameraAllControls,
  followCameraSchema,
  type FollowCameraConfig,
  type FollowCameraMode
} from '@webgamekit/threejs'
import { useDebugSceneStore } from '@/stores/debugScene'
import { useElementPropertiesStore } from '@/stores/elementProperties'

export type FollowCameraPanelOptions = {
  /** Element name, unique within the scene. */
  name: string
  /** Row label, defaulting to something a player would recognise. */
  label?: string
  /** The camera the view is currently using, so the tabs follow the keyboard too. */
  mode: Ref<FollowCameraMode>
  setMode: (mode: FollowCameraMode) => void
  /** Offsets to start from, defaulting to the package's own. */
  defaults?: Partial<FollowCameraConfig>
}

export type FollowCameraPanel = {
  /** The live config, read by whatever places the camera each frame. */
  config: FollowCameraConfig
  teardown: () => void
}

/**
 * Puts a following camera's offsets on the elements panel, tabbed by mode.
 *
 * The three modes are shown one at a time rather than all at once, and choosing
 * a tab switches the camera as well as the controls, since someone tuning a mode
 * wants to be looking through it. The binding runs both ways: the tabs follow
 * the view's own mode, so cycling the camera from the keyboard moves them too.
 *
 * @param options - Element identity, the view's camera mode, and any overrides
 * @returns The shared config to place the camera from, and a teardown
 */
export const registerFollowCameraPanel = (options: FollowCameraPanelOptions): FollowCameraPanel => {
  const debugSceneStore = useDebugSceneStore()
  const config = reactive<FollowCameraConfig>({ ...DEFAULT_FOLLOW_CAMERA, ...options.defaults })
  const label = options.label ?? 'Run camera'

  const properties = (mode: FollowCameraMode) => ({
    title: label,
    // Deliberately not "Camera". The elements panel routes any type containing
    // that word to the shared camera component, which renders lens and
    // projection instead of the element's own schema, so a row typed Camera
    // here would show the wrong controls entirely.
    type: 'Rig',
    schema: followCameraSchema(mode),
    getValue: (path: string) =>
      path === 'mode' ? options.mode.value : config[path as keyof FollowCameraConfig],
    updateValue: (path: string, value: unknown) => {
      if (path === 'mode') {
        options.setMode(value as FollowCameraMode)
        return
      }
      config[path as keyof FollowCameraConfig] = value as number
    }
  })

  debugSceneStore.addSceneElement(
    { name: options.name, type: 'Rig', label, hidden: false },
    properties(options.mode.value)
  )

  // Re-registered rather than filtered in the panel, which keeps the tabbing in
  // the caller that wants it instead of in a component every view shares.
  const stop = watch(options.mode, (mode) => {
    useElementPropertiesStore().registerElementProperties(options.name, properties(mode))
  })

  return {
    config,
    teardown: () => {
      stop()
      debugSceneStore.removeSceneElement(options.name)
    }
  }
}

export { followCameraAllControls }
