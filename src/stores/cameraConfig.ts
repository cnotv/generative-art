import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { CameraPreset, DEFAULT_FOLLOW_CAMERA } from '@webgamekit/threejs'
import type { CoordinateTuple, FollowCameraConfig } from '@webgamekit/threejs'

export interface CameraSlot {
  id: string
  label: string
  preset: CameraPreset
  position: CoordinateTuple
  fov: number
  orbitTarget: CoordinateTuple
  supportedCameraTypes?: Array<'perspective' | 'orthographic'>
}

/**
 * A follow view a rig offers, shown on the camera panel so the follow cameras sit beside the
 * lens presets rather than only on the rig's own row.
 */
export interface CameraFollowView {
  value: string
  label: string
}

/** A single tunable offset on the follow settings, rendered as a labelled slider. */
export interface CameraFollowSetting {
  key: keyof FollowCameraConfig
  label: string
  min: number
  max: number
  step: number
}

export interface CameraConfigHandlers {
  onPresetChange: (slotId: string, preset: CameraPreset) => void
  onSlotActivate: (slotId: string) => void
  onCleanup: () => void
  onUpdate?: (slotId: string) => void
  onRotate?: (slotId: string, degrees: number) => void
  /** Turns dragging the camera on or off, as a preset or the panel's own toggle asks. */
  onOrbitToggle?: (enabled: boolean) => void
  /**
   * Puts the camera back where the scene declared it.
   * @returns The projection restored, so the panel can show the matching preset
   */
  onResetToSceneDefault?: () => 'perspective' | 'orthographic' | void
}

const DEFAULT_CAMERA_SLOT_ID = 'cam-default'
const DEFAULT_CAMERA_POSITION: CoordinateTuple = [0, 5, 20]
const DEFAULT_CAMERA_FOV = 75
const DEFAULT_CAMERA_ORBIT_TARGET: CoordinateTuple = [0, 0, 0]

const DEFAULT_CAMERA_SLOT: CameraSlot = {
  id: DEFAULT_CAMERA_SLOT_ID,
  label: 'Camera 1',
  preset: CameraPreset.Perspective,
  position: DEFAULT_CAMERA_POSITION,
  fov: DEFAULT_CAMERA_FOV,
  orbitTarget: DEFAULT_CAMERA_ORBIT_TARGET
}

export const useCameraConfigStore = defineStore('cameraConfig', () => {
  const cameraSlots = ref<CameraSlot[]>([DEFAULT_CAMERA_SLOT])
  const activeSlotId = ref<string | null>(DEFAULT_CAMERA_SLOT_ID)
  const handlers = ref<CameraConfigHandlers | null>(null)
  const transitionEnabled = ref(false)
  const followViews = ref<CameraFollowView[]>([])
  const activeFollowView = ref<string | null>(null)
  const followViewHandler = ref<((value: string | null) => void) | null>(null)
  const followConfig = ref<FollowCameraConfig>({ ...DEFAULT_FOLLOW_CAMERA })
  const followSettings = ref<CameraFollowSetting[]>([])
  const followTargetLabel = ref<string | null>(null)
  const lastFollowView = ref<string | null>(null)
  const followTargets = ref<CameraFollowView[]>([])
  const activeFollowTarget = ref<string | null>(null)
  const followTargetHandler = ref<((name: string | null) => void) | null>(null)
  const followResetHandler = ref<(() => void) | null>(null)

  /**
   * Registers how to put the follow offsets back to what the scene asked for.
   * @param onReset - Restores the rig's own declared defaults
   */
  const registerFollowReset = (onReset: () => void) => {
    followResetHandler.value = onReset
  }

  /**
   * Publishes what the camera could follow, and picks for the player when there is no choice.
   *
   * A scene with one model in it has exactly one answer, and making someone open a dropdown to
   * give it is a step that teaches them nothing.
   * @param targets - The elements a camera could follow
   * @param onChange - Called with the chosen element's name
   * @param preferred - The one to start on, for a scene that knows which of several it means
   */
  const registerFollowTargets = (
    targets: CameraFollowView[],
    onChange: (name: string | null) => void,
    preferred?: string
  ) => {
    followTargets.value = targets
    followTargetHandler.value = onChange
    const stillThere = targets.some((target) => target.value === activeFollowTarget.value)
    if (stillThere) return
    const preferredExists = targets.some((target) => target.value === preferred)
    setFollowTarget(preferredExists ? preferred! : targets.length === 1 ? targets[0].value : null)
  }

  const setFollowTarget = (name: string | null) => {
    activeFollowTarget.value = name
    followTargetHandler.value?.(name)
  }
  const orbitEnabled = ref(false)

  const setOrbitEnabled = (enabled: boolean) => {
    orbitEnabled.value = enabled
    handlers.value?.onOrbitToggle?.(enabled)
  }

  /**
   * Records orbit state the camera already has, without asking for it again.
   *
   * Used when a preset carries its own orbit setting: the preset has applied it to the controls
   * already, and calling back through the handler would ask a second time.
   * @param enabled Whether dragging the camera is on
   */
  const syncOrbitEnabled = (enabled: boolean) => {
    orbitEnabled.value = enabled
  }

  /**
   * Puts the camera back to the framing its own scene declared.
   *
   * Every scene sets its camera up differently, so there is no single default to go back to —
   * the one worth having is whatever this scene asked for before anything was touched.
   */
  const resetCameraToSceneDefault = () => {
    releaseCameraFromRig()
    // The rig's offsets are camera settings too: leaving a dragged height behind means the next
    // follow view is framed by whatever was last fiddled with rather than by the scene.
    followResetHandler.value?.()
    const restored = handlers.value?.onResetToSceneDefault?.()
    if (!restored || !activeSlotId.value) return
    // The slot is retyped rather than the preset re-applied: applying it would move the camera
    // again, away from the framing just restored. This only makes the panel agree with it.
    const slotId = activeSlotId.value
    const preset =
      restored === 'orthographic' ? CameraPreset.Orthographic : CameraPreset.Perspective
    cameraSlots.value = cameraSlots.value.map((slot) =>
      slot.id === slotId ? { ...slot, preset } : slot
    )
  }

  /**
   * Replaces one follow offset, in place, so whatever places the camera reads it next frame.
   * @param key Which setting to change
   * @param value Its new value, a number for an offset or a flag for a switch
   */
  const updateFollowSetting = (key: keyof FollowCameraConfig, value: number | boolean) => {
    Object.assign(followConfig.value, { [key]: value })
  }

  /**
   * Publishes a rig's follow views to the camera panel.
   * @param views The views to offer, in the order they should appear
   * @param active Which one is in effect, or null while the rig is switched off
   * @param onChange Called with the chosen view, or null to switch the rig off
   */
  const registerFollowViews = (
    views: CameraFollowView[],
    active: string | null,
    onChange: (value: string | null) => void
  ) => {
    followViews.value = views
    activeFollowView.value = active
    followViewHandler.value = onChange
  }

  /**
   * Publishes the follow offsets a rig exposes, which the camera panel renders as sliders.
   * @param settings The offsets to show for the view in effect
   * @param config The live values
   * @param targetLabel What the camera is following, named on the panel
   */
  const registerFollowSettings = (
    settings: CameraFollowSetting[],
    config: FollowCameraConfig,
    targetLabel: string | null
  ) => {
    followSettings.value = settings
    followConfig.value = config
    followTargetLabel.value = targetLabel
  }

  const setActiveFollowView = (active: string | null) => {
    activeFollowView.value = active
    if (active !== null) lastFollowView.value = active
  }

  /** Turns following back on with whichever view was last in effect. */
  const resumeFollowView = () =>
    selectFollowView(lastFollowView.value ?? followViews.value[0]?.value ?? null)

  const unregisterFollowViews = () => {
    followViews.value = []
    activeFollowView.value = null
    followViewHandler.value = null
    followSettings.value = []
    followTargetLabel.value = null
    followTargets.value = []
    activeFollowTarget.value = null
    followTargetHandler.value = null
    followResetHandler.value = null
  }

  const selectFollowView = (value: string | null) => followViewHandler.value?.(value)

  /**
   * Hands the camera to this panel's own controls.
   *
   * A rig that writes position and aim every frame overwrites a preset, a rotation or a dragged
   * coordinate before it is ever seen, so reaching for one of those means letting go of the rig.
   */
  const releaseCameraFromRig = () => {
    if (activeFollowView.value !== null) selectFollowView(null)
  }

  const setTransitionEnabled = (enabled: boolean) => {
    transitionEnabled.value = enabled
  }

  const activeSlot = computed<CameraSlot | null>(
    () => cameraSlots.value.find((s) => s.id === activeSlotId.value) ?? null
  )

  const resetState = () => {
    cameraSlots.value = [DEFAULT_CAMERA_SLOT]
    activeSlotId.value = DEFAULT_CAMERA_SLOT_ID
    handlers.value = null
    unregisterFollowViews()
  }

  const registerCameraHandlers = (
    initialSlots: CameraSlot[],
    newHandlers: CameraConfigHandlers
  ) => {
    cameraSlots.value = [...initialSlots]
    handlers.value = newHandlers
    activeSlotId.value = initialSlots.length > 0 ? initialSlots[0].id : null
  }

  const unregisterCameraHandlers = () => {
    handlers.value?.onCleanup()
    cameraSlots.value = [DEFAULT_CAMERA_SLOT]
    activeSlotId.value = DEFAULT_CAMERA_SLOT_ID
    handlers.value = null
  }

  const addCameraSlot = () => {
    const nextNumber = cameraSlots.value.length + 1
    const newSlot: CameraSlot = {
      id: `cam-${Date.now()}-${nextNumber}`,
      label: `Camera ${nextNumber}`,
      preset: CameraPreset.Perspective,
      position: DEFAULT_CAMERA_POSITION,
      fov: DEFAULT_CAMERA_FOV,
      orbitTarget: DEFAULT_CAMERA_ORBIT_TARGET
    }
    cameraSlots.value = [...cameraSlots.value, newSlot]
  }

  const removeCameraSlot = (id: string) => {
    const wasActive = activeSlotId.value === id
    cameraSlots.value = cameraSlots.value.filter((s) => s.id !== id)

    if (wasActive && cameraSlots.value.length > 0) {
      const nextId = cameraSlots.value[0].id
      activeSlotId.value = nextId
      handlers.value?.onSlotActivate(nextId)
    }
  }

  const renameCameraSlot = (id: string, label: string) => {
    cameraSlots.value = cameraSlots.value.map((s) => (s.id === id ? { ...s, label } : s))
  }

  const activateCameraSlot = (id: string) => {
    activeSlotId.value = id
    handlers.value?.onSlotActivate(id)
  }

  const applyPresetToActiveSlot = (preset: CameraPreset) => {
    if (!activeSlotId.value) return
    releaseCameraFromRig()

    const slotId = activeSlotId.value
    cameraSlots.value = cameraSlots.value.map((s) => (s.id === slotId ? { ...s, preset } : s))
    handlers.value?.onPresetChange(slotId, preset)
  }

  const rotateActiveSlot = (degrees: number) => {
    if (!activeSlotId.value) return
    releaseCameraFromRig()
    handlers.value?.onRotate?.(activeSlotId.value, degrees)
  }

  const updateActiveSlotField = (field: keyof CameraSlot, value: unknown) => {
    if (!activeSlotId.value) return

    const slotId = activeSlotId.value
    cameraSlots.value = cameraSlots.value.map((s) =>
      s.id === slotId ? { ...s, [field]: value } : s
    )
    if (field === 'position' || field === 'fov' || field === 'orbitTarget') {
      handlers.value?.onUpdate?.(slotId)
    }
  }

  const syncActiveSlotPosition = (position: CoordinateTuple) => {
    if (!activeSlotId.value) return
    const slotId = activeSlotId.value
    cameraSlots.value = cameraSlots.value.map((s) => (s.id === slotId ? { ...s, position } : s))
  }

  const syncActiveSlotOrbitTarget = (orbitTarget: CoordinateTuple) => {
    if (!activeSlotId.value) return
    const slotId = activeSlotId.value
    cameraSlots.value = cameraSlots.value.map((s) => (s.id === slotId ? { ...s, orbitTarget } : s))
  }

  return {
    cameraSlots,
    activeSlotId,
    activeSlot,
    resetState,
    registerCameraHandlers,
    unregisterCameraHandlers,
    addCameraSlot,
    removeCameraSlot,
    renameCameraSlot,
    activateCameraSlot,
    applyPresetToActiveSlot,
    rotateActiveSlot,
    transitionEnabled,
    setTransitionEnabled,
    updateActiveSlotField,
    syncActiveSlotPosition,
    syncActiveSlotOrbitTarget,
    followViews,
    activeFollowView,
    followConfig,
    followSettings,
    followTargetLabel,
    followTargets,
    activeFollowTarget,
    registerFollowTargets,
    registerFollowReset,
    releaseCameraFromRig,
    setFollowTarget,
    resumeFollowView,
    orbitEnabled,
    setOrbitEnabled,
    syncOrbitEnabled,
    resetCameraToSceneDefault,
    updateFollowSetting,
    registerFollowViews,
    registerFollowSettings,
    setActiveFollowView,
    unregisterFollowViews,
    selectFollowView
  }
})
