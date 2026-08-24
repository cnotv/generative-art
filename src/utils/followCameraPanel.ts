import { reactive, ref, watch, type Ref } from 'vue'
import {
  DEFAULT_FOLLOW_CAMERA,
  FOLLOW_CAMERA_MODES,
  followCameraAllControls,
  followCameraSchema,
  type FollowCameraConfig,
  type FollowCameraMode
} from '@webgamekit/threejs'
import {
  useCameraConfigStore,
  type CameraFollowSetting,
  type CameraFollowView
} from '@/stores/cameraConfig'
import { useDebugSceneStore, type SceneElement } from '@/stores/debugScene'

/**
 * Element types and names that describe the scene rather than something in it.
 *
 * A camera cannot usefully follow the ground it stands on, the sky around it, a light, another
 * camera, or the rig and route that drive it.
 */
const SCENERY_TYPES = ['camera', 'light', 'rig', 'texturearea']
const SCENERY_NAMES = ['ground', 'sky', 'pathdebug']

/**
 * The elements a camera could follow, drawn from what the elements panel is showing.
 * @param elements - Every element currently in the scene list
 * @returns Those that are a thing in the scene rather than the scene itself
 */
export const followCameraCandidates = (elements: SceneElement[]): CameraFollowView[] =>
  elements
    .filter((element) => {
      const type = element.type.toLowerCase()
      const name = element.name.toLowerCase()
      return (
        !SCENERY_TYPES.some((scenery) => type.includes(scenery)) &&
        !SCENERY_NAMES.includes(name) &&
        element.groupId === undefined
      )
    })
    .map((element) => ({ value: element.name, label: element.label ?? element.name }))

/** Panel labels for the follow views, so the camera panel names them as a player would. */
const FOLLOW_VIEW_LABELS: Record<FollowCameraMode, string> = {
  third: 'Third Person',
  first: 'First Person',
  free: 'Free Chase'
}

const DEFAULT_VIEWS: CameraFollowView[] = FOLLOW_CAMERA_MODES.map((value) => ({
  value,
  label: FOLLOW_VIEW_LABELS[value]
}))

export type FollowCameraPanelOptions = {
  /** The camera the view is currently using, so the panel follows the keyboard too. */
  mode: Ref<FollowCameraMode>
  setMode: (mode: FollowCameraMode) => void
  /** Offsets to start from, defaulting to the package's own. */
  defaults?: Partial<FollowCameraConfig>
  /**
   * Which element to start on, when a scene has several candidates and knows which it means.
   * The panel can still be pointed at any of the others.
   */
  defaultTarget?: string
  /**
   * The views the panel offers, when the caller has more than the three follow modes — a
   * cinematic path, say. Defaults to the follow modes alone.
   */
  views?: CameraFollowView[]
  /** Which view is in effect, when it is not simply the follow mode. */
  activeView?: Ref<string>
  /** Chooses a view, when picking one means more than setting the follow mode. */
  selectView?: (value: string) => void
  /**
   * Locks in the framing the camera already has, whenever following is switched on.
   *
   * Without it, turning a rig on snaps the camera to whatever offsets the config holds. With
   * it, the shot the scene was built around is what the rig keeps.
   * @param targetName - The element being followed, passed in because a caller cannot read it
   * off the panel while the panel is still being built
   * @returns The offsets to adopt, or nothing when there is no target to measure against
   */
  calibrate?: (targetName: string | null) => Partial<FollowCameraConfig> | null

  /**
   * Whether the rig drives the camera from the moment it is registered.
   *
   * Off by default: a scene declares its own camera, and a rig that seizes it on load means the
   * framing the scene was built around is never the one anyone sees.
   */
  followOnStart?: boolean
}

export type FollowCameraPanel = {
  /** The live config, read by whatever places the camera each frame. */
  config: FollowCameraConfig
  /**
   * Whether the rig should place the camera at all.
   *
   * Off hands the camera to the Camera element's own controls: a rig that writes position and
   * aim every frame overwrites a preset, a rotation or a dragged coordinate before it is seen.
   */
  enabled: Ref<boolean>
  /** The scene element the panel is pointing at, for the caller to resolve to an object. */
  targetName: Ref<string | null>
  teardown: () => void
}

/** The offsets one mode exposes, read off the package's own schema so the two cannot drift. */
const settingsForMode = (mode: FollowCameraMode): CameraFollowSetting[] => {
  const { mode: _selector, ...offsets } = followCameraSchema(mode)
  return Object.entries(offsets).map(([key, control]) => {
    const { label, min, max, step } = control as Record<string, never>
    return {
      key: key as keyof FollowCameraConfig,
      label: label ?? key,
      min: min ?? 0,
      max: max ?? 1,
      step: step ?? 0.1
    }
  })
}

/**
 * Puts a following camera on the Camera element: its views beside the lens presets, and the
 * offsets of whichever view is in effect below them.
 *
 * There is no row of its own. A rig is a way of driving the camera, not a second thing in the
 * scene, and splitting the two left a player toggling one while the other quietly overrode it.
 *
 * @param options - The view's camera mode, what it follows, and any overrides
 * @returns The shared config to place the camera from, the on switch, and a teardown
 */
export const registerFollowCameraPanel = (options: FollowCameraPanelOptions): FollowCameraPanel => {
  const cameraConfigStore = useCameraConfigStore()
  const debugSceneStore = useDebugSceneStore()
  const declared: FollowCameraConfig = { ...DEFAULT_FOLLOW_CAMERA, ...options.defaults }
  const config = reactive<FollowCameraConfig>({ ...declared })
  // Starts off even when the caller wants it on, so switching it on goes through setEnabled and
  // gets the same calibration as every later toggle.
  const enabled = ref(false)
  const targetName = ref<string | null>(null)
  const activeView = () => options.activeView?.value ?? options.mode.value

  /**
   * Switches the rig on or off, keeping the panel's own highlight in step.
   * @param next Whether the rig should place the camera
   */
  const setEnabled = (next: boolean) => {
    // Measured before the rig takes over, so the first frame it drives is the frame it saw.
    if (next && !enabled.value) {
      const calibrated = options.calibrate?.(targetName.value)
      if (calibrated) Object.assign(config, calibrated)
    }
    enabled.value = next
    cameraConfigStore.setActiveFollowView(next ? activeView() : null)
  }

  const publishSettings = (mode: FollowCameraMode) =>
    cameraConfigStore.registerFollowSettings(settingsForMode(mode), config, targetName.value)

  /** Offers whatever the elements panel is showing that a camera could sensibly follow. */
  const publishTargets = () =>
    cameraConfigStore.registerFollowTargets(
      followCameraCandidates(debugSceneStore.sceneElements),
      (name) => {
        targetName.value = name
        publishSettings(options.mode.value)
      },
      options.defaultTarget
    )

  // Mutated in place rather than replaced: the render loop holds this object.
  cameraConfigStore.registerFollowReset(() => Object.assign(config, declared))

  publishTargets()
  const stopTargets = watch(() => debugSceneStore.sceneElements, publishTargets, { deep: true })

  cameraConfigStore.registerFollowViews(
    options.views ?? DEFAULT_VIEWS,
    enabled.value ? activeView() : null,
    (value) => {
      setEnabled(value !== null)
      if (value === null) return
      if (options.selectView) options.selectView(value)
      else options.setMode(value as FollowCameraMode)
    }
  )
  publishSettings(options.mode.value)
  if (options.followOnStart) setEnabled(true)

  const stopMode = watch(options.mode, (mode) => publishSettings(mode))
  const stopView = watch(
    () => activeView(),
    (view) => {
      if (enabled.value) cameraConfigStore.setActiveFollowView(view)
    }
  )

  return {
    config,
    enabled,
    targetName,
    teardown: () => {
      stopMode()
      stopView()
      stopTargets()
      cameraConfigStore.unregisterFollowViews()
    }
  }
}

export { followCameraAllControls }
