<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import * as THREE from 'three'
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { getTools } from '@webgamekit/threejs'
import type { LoadProgress } from '@webgamekit/threejs'
import { createTimelineManager } from '@webgamekit/animation'
import { createControls } from '@webgamekit/controls'
import { ikFindTwoBoneChain, type TwoBoneIkChain } from '@webgamekit/rig'
import {
  Upload,
  Camera as CameraIcon,
  Lightbulb,
  Circle,
  Bone,
  Eye,
  Ruler,
  Settings,
  Square
} from 'lucide-vue-next'
import LoadingOverlay from '@/components/LoadingOverlay.vue'
import IconButton from '@/components/IconButton.vue'
import { createReactiveConfig } from '@/stores/viewConfig'
import { useDebugSceneStore } from '@/stores/debugScene'
import {
  RIG_ANIMATOR_SETUP_CONFIG,
  DEFAULT_FPS,
  DEFAULT_MODEL_PATH,
  MODEL_FILE_ACCEPT,
  CAMERA_PANEL_WIDTH_VW,
  CAMERA_SMOOTHING_MILLISECONDS,
  CAMERA_LANDMARK_MAX_JUMP_METERS,
  CAMERA_SMOOTHING_SPEED_RESPONSE,
  CAMERA_SMOOTHING_TURN_RESPONSE,
  CAMERA_SMOOTHING_SPEED_CUTOFF_HERTZ,
  CAMERA_BONE_SMOOTHING_MILLISECONDS,
  CAMERA_BONE_MAX_TURN_DEGREES_PER_SECOND,
  CAMERA_HAND_FLIP_DEGREES,
  CAMERA_HAND_HOLD_MILLISECONDS,
  CAMERA_LANDMARK_VISIBILITY_THRESHOLD,
  CAMERA_TWIST_MIN_BEND_DEGREES,
  CAMERA_TWIST_FULL_BEND_DEGREES,
  CAMERA_VIDEO_SLOWDOWN_RATIO,
  RECORDING_SAMPLES_PER_FRAME,
  RIG_TIMELINE_KEYBOARD_MAPPING,
  DEFAULT_MARBLE_SPAWN_INTERVAL_FRAMES,
  DEFAULT_ENCLOSURE_SIZE_FRACTION,
  DEFAULT_ENCLOSURE_OPACITY
} from './config'
import { useRigLimbCheck } from './useRigLimbCheck'
import { buildRigPanelGroups } from './panelSchema'
import RigConfigAccordion from './RigConfigAccordion.vue'
import { useRigAnimator } from './useRigAnimator'
import { useRigMotionRecording } from './useRigMotionRecording'
import { centerCameraOnVisibleCanvas, frameCameraOnModel } from './cameraFraming'
import {
  createRigGround,
  disposeRigGround,
  fitShadowToModel,
  rigGroundPlacement
} from './rigGround'
import { estimateCameraYaw } from './cameraPoseMapping'
import {
  selectedBodyPartGroups,
  toggleBodyPartGroupTarget,
  RIG_BODY_PART_GROUP_LABELS,
  type RigBodyPartGroup
} from './bodyPartGroups'
import MergeTargetDiagram from './MergeTargetDiagram.vue'
import { beginBoneDragPlane, boneDragTargetFromEvent } from './boneDragPlane'
import { applyPoleDrag } from './boneDragTarget'
import { loadRigAutosave } from './autosave'
import RigTimeline from './RigTimeline.vue'
import CameraPoseCapture from './CameraPoseCapture.vue'
import type {
  CameraDetectionOptions,
  CameraPoseFrame,
  CameraPoseMappingOptions,
  CameraSmoothingSettings,
  RigAnimatorConfig
} from './types'

const { registerSceneElements, clearSceneElements } = useDebugSceneStore()

const canvas = ref<HTMLCanvasElement | null>(null)
const loadingVisible = ref(true)
const loadingStage = ref('Loading…')
const loadingDetail = ref<string | undefined>(undefined)
const handleProgress = (progress: LoadProgress): void => {
  loadingVisible.value = !progress.done
  loadingStage.value = progress.stage
  loadingDetail.value = progress.detail
}

const reactiveConfig = createReactiveConfig<RigAnimatorConfig>({
  model: '',
  poses: '',
  selectedBone: '',
  boneRotation: { x: 0, y: 0, z: 0 },
  bonePosition: { x: 0, y: 0, z: 0 },
  frame: 0,
  fps: DEFAULT_FPS,
  showBoneMarkers: false,
  cameraGroundFeet: true,
  cameraTurnHips: true,
  cameraBendSpine: true,
  cameraTurnHead: true,
  cameraCorrectHeadPitch: true,
  cameraLimitHeadTurn: true,
  cameraAimArms: true,
  cameraRollUpperArms: true,
  cameraRollForearms: true,
  cameraPalmsFromBody: false,
  cameraAimLegs: true,
  cameraRollThighs: true,
  cameraAimFeet: true,
  cameraFitReach: true,
  cameraLimitJoints: true,
  cameraTrackFace: true,
  cameraSearchFaceAroundBody: true,
  cameraTrackHands: true,
  cameraSearchHandsAroundWrists: true,
  cameraSideHandsByWrist: true,
  cameraIgnoreOutsideImage: true,
  cameraMirrorLive: true,
  cameraDetectOnlyWhilePlaying: true,
  cameraUseDepth: true,
  cameraUseViewpoint: false,
  cameraSmoothingMilliseconds: CAMERA_SMOOTHING_MILLISECONDS,
  cameraMaxJump: CAMERA_LANDMARK_MAX_JUMP_METERS,
  cameraSpeedResponse: CAMERA_SMOOTHING_SPEED_RESPONSE,
  cameraTurnResponse: CAMERA_SMOOTHING_TURN_RESPONSE,
  cameraSpeedCutoffHertz: CAMERA_SMOOTHING_SPEED_CUTOFF_HERTZ,
  cameraHandHoldMilliseconds: CAMERA_HAND_HOLD_MILLISECONDS,
  cameraHandFlipDegrees: CAMERA_HAND_FLIP_DEGREES,
  cameraBoneSmoothingMilliseconds: CAMERA_BONE_SMOOTHING_MILLISECONDS,
  cameraBoneMaxTurnSpeed: CAMERA_BONE_MAX_TURN_DEGREES_PER_SECOND,
  cameraVisibilityThreshold: CAMERA_LANDMARK_VISIBILITY_THRESHOLD,
  cameraTwistMinBendDegrees: CAMERA_TWIST_MIN_BEND_DEGREES,
  cameraTwistFullBendDegrees: CAMERA_TWIST_FULL_BEND_DEGREES,
  cameraShowPreview: false,
  cameraVideoSlowdownRatio: CAMERA_VIDEO_SLOWDOWN_RATIO,
  targetLeftArm: true,
  targetRightArm: true,
  targetLeftLeg: true,
  targetRightLeg: true,
  targetSpineHead: true,
  physicsEnabled: false,
  marbleFlowEnabled: false,
  marbleSpawnInterval: DEFAULT_MARBLE_SPAWN_INTERVAL_FRAMES,
  marbleTextures: true,
  enclosureSize: DEFAULT_ENCLOSURE_SIZE_FRACTION,
  enclosureOpacity: DEFAULT_ENCLOSURE_OPACITY
})

const cameraPoseMappingOptions = computed(
  (): CameraPoseMappingOptions => ({
    includeDepth: reactiveConfig.value.cameraUseDepth,
    groundFeet: reactiveConfig.value.cameraGroundFeet,
    turnHips: reactiveConfig.value.cameraTurnHips,
    bendSpine: reactiveConfig.value.cameraBendSpine,
    turnHead: reactiveConfig.value.cameraTurnHead,
    correctHeadPitch: reactiveConfig.value.cameraCorrectHeadPitch,
    limitHeadTurn: reactiveConfig.value.cameraLimitHeadTurn,
    aimArms: reactiveConfig.value.cameraAimArms,
    rollUpperArmsFromElbows: reactiveConfig.value.cameraRollUpperArms,
    rollForearmsToPalms: reactiveConfig.value.cameraRollForearms,
    palmsFromBodyLandmarks: reactiveConfig.value.cameraPalmsFromBody,
    aimLegs: reactiveConfig.value.cameraAimLegs,
    rollThighsFromKneesAndFeet: reactiveConfig.value.cameraRollThighs,
    aimFeet: reactiveConfig.value.cameraAimFeet,
    fitLimbReach: reactiveConfig.value.cameraFitReach,
    visibilityThreshold: reactiveConfig.value.cameraVisibilityThreshold,
    twistMinBendRadians: THREE.MathUtils.degToRad(reactiveConfig.value.cameraTwistMinBendDegrees),
    twistFullBendRadians: THREE.MathUtils.degToRad(reactiveConfig.value.cameraTwistFullBendDegrees),
    boneSmoothingMilliseconds: reactiveConfig.value.cameraBoneSmoothingMilliseconds,
    limitJoints: reactiveConfig.value.cameraLimitJoints,
    maxBoneTurnRadiansPerSecond: THREE.MathUtils.degToRad(
      reactiveConfig.value.cameraBoneMaxTurnSpeed
    )
  })
)

const cameraSmoothingSettings = computed(
  (): CameraSmoothingSettings => ({
    smoothingMilliseconds: reactiveConfig.value.cameraSmoothingMilliseconds,
    maxJump: reactiveConfig.value.cameraMaxJump,
    speedResponse: reactiveConfig.value.cameraSpeedResponse,
    turnResponse: reactiveConfig.value.cameraTurnResponse,
    speedCutoffHertz: reactiveConfig.value.cameraSpeedCutoffHertz,
    handHoldMilliseconds: reactiveConfig.value.cameraHandHoldMilliseconds,
    handFlipRadians: THREE.MathUtils.degToRad(reactiveConfig.value.cameraHandFlipDegrees)
  })
)

const cameraDetectionOptions = computed(
  (): CameraDetectionOptions => ({
    trackFace: reactiveConfig.value.cameraTrackFace,
    searchFaceAroundBody: reactiveConfig.value.cameraSearchFaceAroundBody,
    trackHands: reactiveConfig.value.cameraTrackHands,
    searchHandsAroundWrists: reactiveConfig.value.cameraSearchHandsAroundWrists,
    sideHandsByNearestWrist: reactiveConfig.value.cameraSideHandsByWrist,
    ignoreLandmarksOutsideImage: reactiveConfig.value.cameraIgnoreOutsideImage,
    mirrorLiveCamera: reactiveConfig.value.cameraMirrorLive,
    detectOnlyWhilePlaying: reactiveConfig.value.cameraDetectOnlyWhilePlaying
  })
)

/** Which body-part groups the next capture, photo or preset is allowed to touch, read from the
 * Merge Target diagram's own toggled regions; see `bodyPartGroups.ts`. */
const targetBodyPartGroups = computed(() => selectedBodyPartGroups(reactiveConfig.value))
const targetBodyPartGroupLabels = computed(() =>
  [...targetBodyPartGroups.value].map((group) => RIG_BODY_PART_GROUP_LABELS[group])
)

const rig = useRigAnimator(reactiveConfig)
/** Whether the rig panel is open: the camera preview, its actions and every setting. */
const showRigPanel = ref(false)
/** Whether the reach is being judged: bones shown, and the crossing check running over
 * whatever is posing the rig right now, a capture or a playback alike. */
const showLimbCheck = ref(false)
const limbCheck = useRigLimbCheck(rig.bones, showLimbCheck)
const modelFileInput = ref<HTMLInputElement | null>(null)
const rigTimelineReference = ref<InstanceType<typeof RigTimeline> | null>(null)
const cameraCaptureReference = ref<InstanceType<typeof CameraPoseCapture> | null>(null)
const motionRecording = useRigMotionRecording({
  now: () => cameraCaptureReference.value?.captureClockMilliseconds() ?? performance.now(),
  fps: () => reactiveConfig.value.fps,
  samplesPerFrame: () =>
    cameraCaptureReference.value?.captureSamplesPerFrame() ?? RECORDING_SAMPLES_PER_FRAME,
  currentFrame: () => reactiveConfig.value.frame,
  frameMax: () => rig.frameMax.value,
  setFrame: (frame) => (reactiveConfig.value.frame = frame),
  setFrameMax: (frameMax) => rig.setFrameMax(frameMax),
  // Silent: rebuilding the preview clip and persisting on every one of a fast burst of
  // sampled frames made each capture slower than the last (see captureKeyframeSilently's own
  // doc comment) and was the actual cause of the stutter recording had — not the camera feed
  // itself. stopRecordingAndCommit below pays that cost once, when the burst ends.
  addKeyframe: () => rig.captureKeyframeSilently(),
  capturePose: () => rig.capturePose(),
  replaceTake: (fromFrame, toFrame, keyframes) =>
    rig.replaceRecordedTake(fromFrame, toFrame, keyframes)
})

/** Stop recording and, in the same step, pay the rebuild-and-persist cost the recording loop
 * skipped on every sampled frame — see the `addKeyframe` comment above. Both call sites that
 * stop a recording (the toggle and closing the panel) go through this so neither forgets it.
 * A take that actually captured motion is also snapshotted into the preset picker, the same
 * way a bundled mocap clip is offered there, so it can be reloaded later in the session. */
const stopRecordingAndCommit = (): void => {
  motionRecording.stopRecording()
  rig.commitRecordedKeyframes()
  if (motionRecording.capturedFrameCount.value > 0) rig.addRecordedPreset(rig.keyframes.value)
}

/** A preset picked in the timeline dropdown is either a bundled mocap URL or a session
 * recording, encoded as `recording:<index>` by `RigTimeline`'s own option list. */
const handleSelectPreset = (value: string): void => {
  const recordingIndex = value.startsWith('recording:')
    ? Number(value.slice('recording:'.length))
    : null
  if (recordingIndex !== null) rig.applyRecordedPreset(recordingIndex, targetBodyPartGroups.value)
  else rig.loadPreset(value, targetBodyPartGroups.value)
}

let cameraReference: THREE.Camera | null = null
let sceneReference: THREE.Scene | null = null
let groundReference: THREE.Mesh | null = null

/** Replace the ground with one sized to the model just loaded, and point the key light's shadow at it. */
const placeGround = (model: THREE.Object3D): void => {
  if (!sceneReference) return
  if (groundReference) {
    sceneReference.remove(groundReference)
    disposeRigGround(groundReference)
  }
  const placement = rigGroundPlacement(model)
  groundReference = placement ? createRigGround(placement) : null
  if (!placement || !groundReference) return
  sceneReference.add(groundReference)
  const keyLight = sceneReference.children.find(
    (child): child is THREE.DirectionalLight => child instanceof THREE.DirectionalLight
  )
  if (keyLight) fitShadowToModel(keyLight, model, placement)
}
let orbitReference: OrbitControls | null = null
let hasRestoredAutosave = false
let timelineControls: ReturnType<typeof createControls> | null = null
/** Which drag is in flight: a plain target drag on a bone, or a pole-hint drag on its chain's mid joint. */
let dragTargetBone: THREE.Bone | null = null
let dragPoleChain: TwoBoneIkChain | null = null
const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()

const setPointerFromEvent = (event: PointerEvent): void => {
  if (!canvas.value) return
  const rect = canvas.value.getBoundingClientRect()
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
}

/**
 * Pick a bone marker under the pointer and arm a drag on it. Dragging the mid joint (elbow,
 * knee) of the currently selected bone's own chain re-aims its bend without moving the
 * selection or its target; dragging anything else selects it and poses it toward the pointer.
 * Either way the rest of the gesture (`onWindowPointerMove`) reads off a plane facing the
 * camera, so the motion always tracks the cursor 1:1 instead of jumping with a world axis.
 */
const onCanvasPointerDown = (event: PointerEvent): void => {
  if (!canvas.value || !cameraReference) return
  setPointerFromEvent(event)
  raycaster.setFromCamera(pointer, cameraReference)
  const hitBone = rig.identifyBoneFromRay(raycaster)
  if (!hitBone) return

  const selectedChain = rig.selectedBone.value ? ikFindTwoBoneChain(rig.selectedBone.value) : null
  if (selectedChain && hitBone === selectedChain.mid) {
    dragPoleChain = selectedChain
  } else {
    rig.selectBone(hitBone.name)
    dragTargetBone = hitBone
  }
  beginBoneDragPlane(cameraReference, hitBone.getWorldPosition(new THREE.Vector3()))
  if (orbitReference) orbitReference.enabled = false
  window.addEventListener('pointermove', onWindowPointerMove)
  window.addEventListener('pointerup', onWindowPointerUp)
}

const onWindowPointerMove = (event: PointerEvent): void => {
  if (!canvas.value || !cameraReference) return
  const target = boneDragTargetFromEvent(event, canvas.value, cameraReference)
  if (!target) return
  if (dragPoleChain) applyPoleDrag(dragPoleChain, target)
  else if (dragTargetBone) rig.applyBoneDragTarget(dragTargetBone, target)
}

const onWindowPointerUp = (): void => {
  dragTargetBone = null
  dragPoleChain = null
  if (orbitReference) orbitReference.enabled = true
  window.removeEventListener('pointermove', onWindowPointerMove)
  window.removeEventListener('pointerup', onWindowPointerUp)
}

/** Keeps the model centred beside the docked camera preview; see `centerCameraOnVisibleCanvas`. */
const updateCameraCentering = (): void => {
  const activeCamera = cameraReference
  if (!canvas.value) return
  if (
    !(activeCamera instanceof THREE.PerspectiveCamera) &&
    !(activeCamera instanceof THREE.OrthographicCamera)
  ) {
    return
  }
  const isPreviewCoveringCanvas = showRigPanel.value
  centerCameraOnVisibleCanvas(
    activeCamera,
    canvas.value.clientWidth,
    canvas.value.clientHeight,
    isPreviewCoveringCanvas ? CAMERA_PANEL_WIDTH_VW / 100 : 0
  )
}

/** The rig panel's settings, one accordion section each, for whatever the loaded rig supports. */
const rigPanelGroups = computed(() =>
  buildRigPanelGroups({
    boneNames: rig.boneNames.value,
    needsAutoRig: rig.needsAutoRig.value,
    positionRange: rig.positionRange.value,
    canCaptureFromCamera: rig.canCaptureFromCamera.value,
    physicsEnabled: reactiveConfig.value.physicsEnabled
  })
)

const readRigSetting = (path: string): unknown =>
  (reactiveConfig.value as Record<string, unknown>)[path]

const writeRigSetting = (path: string, value: unknown): void => {
  reactiveConfig.value = { ...reactiveConfig.value, [path]: value }
}

const rigPanelActions: Record<string, () => void> = {
  autoRig: () => rig.runAutoRig(),
  resetBone: () => rig.resetSelectedBone(),
  respawnMarbles: () => rig.rebuildMarbles()
}

const runRigPanelAction = (name: string): void => rigPanelActions[name]?.()

/**
 * Closing the panel only clears the view-offset shift; it does not undo any orbit or pan the
 * user did while the panel was open. Re-framing on close is what actually puts the model back
 * where it started, rather than leaving it wherever the camera was last pointed.
 */
const handleCloseCamera = (): void => {
  showRigPanel.value = false
  if (motionRecording.isRecording.value) stopRecordingAndCommit()
  if (rig.model.value && cameraReference) {
    frameCameraOnModel(cameraReference, orbitReference, rig.model.value)
  }
}

/** Recording and timeline playback both drive the current frame, so only one may run at
 * once: starting either stops the other first rather than letting them fight over it. */
const handleToggleRecord = (): void => {
  if (motionRecording.isRecording.value) {
    stopRecordingAndCommit()
    return
  }
  if (rig.isPlaying.value) rig.togglePlayback()
  motionRecording.startRecording()
}

const handleTogglePlayback = (): void => {
  if (!rig.isPlaying.value && motionRecording.isRecording.value) stopRecordingAndCommit()
  rig.togglePlayback()
}

/** The docked ruler turns on the bone markers and the crossing check together: judging a reach
 * means watching the bones while something drives them. */
const toggleLimbCheck = (): void => {
  showLimbCheck.value = !showLimbCheck.value
  if (showLimbCheck.value) reactiveConfig.value.showBoneMarkers = true
}

/** The docked gear opens the rig panel, or closes it again, without starting the camera. */
const toggleRigPanel = (): void => {
  if (showRigPanel.value) handleCloseCamera()
  else showRigPanel.value = true
}

/** The docked camera starts tracking the performer, opening the rig panel first when it is closed,
 * or stops tracking when the camera is already running. */
const toggleCameraTracking = async (): Promise<void> => {
  if (!showRigPanel.value) {
    showRigPanel.value = true
    await nextTick()
  }
  cameraCaptureReference.value?.toggleCamera()
}

/** Timeline playback keeps running from wherever the playhead is moved to; a paused timeline
 * leaves the jump to the frame watcher. */
const moveToFrame = (frame: number): void => {
  reactiveConfig.value.frame = frame
  if (rig.isPlaying.value) rig.scrubToFrame(frame)
}

/** A region of the Merge Target diagram was clicked or activated by keyboard. */
const handleToggleBodyPartGroup = (group: RigBodyPartGroup): void => {
  reactiveConfig.value = toggleBodyPartGroupTarget(reactiveConfig.value, group)
}

/** The docked physics icon turns the simulation on or off, same toggle shape as the camera one. */
const togglePhysics = (): void => {
  reactiveConfig.value.physicsEnabled = !reactiveConfig.value.physicsEnabled
}

/** The docked marble icon starts or stops the flow; the enclosing walls follow the same switch. */
const toggleMarbleFlow = (): void => {
  reactiveConfig.value.marbleFlowEnabled = !reactiveConfig.value.marbleFlowEnabled
}

/**
 * Applies a detected frame, body, hands and head together, scoped to the Merge Target groups.
 * Optionally also turns the viewing camera to roughly the angle the photo shows the subject
 * from, the one camera-relative detail a single photo's body landmarks can actually support
 * (see `estimateCameraYaw`'s own doc comment for why not more than that).
 */
const handleCameraApply = (frame: CameraPoseFrame): void => {
  // Timeline playback poses the rig from the clip every tick; a live frame landing in between
  // would yank it back to the camera for one frame, which reads as the model twitching.
  if (rig.isPlaying.value) return
  rig.applyCameraPose(frame, cameraPoseMappingOptions.value, targetBodyPartGroups.value)
  const { bodyLandmarks } = frame
  if (
    reactiveConfig.value.cameraUseViewpoint &&
    bodyLandmarks &&
    rig.model.value &&
    cameraReference
  ) {
    const yaw = estimateCameraYaw(bodyLandmarks)
    if (yaw !== null) frameCameraOnModel(cameraReference, orbitReference, rig.model.value, yaw)
  }
  motionRecording.recordFrameIfActive()
}

const handleModelFileChange = (event: Event): void => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  // Tags the real filename onto the blob URL as a fragment: `loadModelFile` picks a loader by
  // extension, and a bare `URL.createObjectURL` result carries none at all.
  if (file) reactiveConfig.value.model = `${URL.createObjectURL(file)}#${file.name}`
}

watch(
  () => reactiveConfig.value.model,
  async (url) => {
    await rig.loadModel(url)
    if (rig.model.value) placeGround(rig.model.value)
    if (rig.model.value && cameraReference) {
      frameCameraOnModel(cameraReference, orbitReference, rig.model.value)
    }
    if (!hasRestoredAutosave) {
      hasRestoredAutosave = true
      const saved = loadRigAutosave()
      if (saved) rig.restoreAutosave(saved)
    }
  }
)
watch(
  () => reactiveConfig.value.poses,
  async (url) => {
    await rig.importJson(url)
  }
)
watch(
  () => reactiveConfig.value.selectedBone,
  (name) => rig.selectBone(name)
)
watch(
  () => reactiveConfig.value.boneRotation,
  (rotation) => rig.applyBoneRotation(rotation),
  { deep: true }
)
watch(
  () => reactiveConfig.value.bonePosition,
  (position) => rig.applyBonePosition(position),
  { deep: true }
)
watch(
  () => reactiveConfig.value.showBoneMarkers,
  (visible) => rig.setMarkersVisible(visible),
  { immediate: true }
)
watch(
  () => reactiveConfig.value.frame,
  (frame) => {
    // During playback the frame field only displays where tickPlayback already put the
    // mixer; scrubbing it back would fight that same-tick update every frame. During
    // recording, handleCameraApply already applied this exact frame's pose straight to the
    // rig's bones before this watcher fires; scrubbing the (unrebuilt, skipped for cost —
    // see captureKeyframeSilently) preview clip on top of it every sampled frame was
    // fighting the live pose it was trying to show, which read as the model stuttering.
    if (!rig.isPlaying.value && !motionRecording.isRecording.value) rig.scrubToFrame(frame)
  }
)
watch(showRigPanel, () => updateCameraCentering())
watch(
  () => reactiveConfig.value.cameraShowPreview,
  () => updateCameraCentering()
)
watch(
  () => reactiveConfig.value.physicsEnabled,
  () => {
    rig.rebuildPhysics()
  }
)
watch(
  () => [reactiveConfig.value.marbleFlowEnabled, reactiveConfig.value.marbleSpawnInterval],
  () => rig.updateMarbleFlow()
)
watch(
  // The walls only show while marbles are flowing: the two switches move together.
  () => [
    reactiveConfig.value.marbleFlowEnabled,
    reactiveConfig.value.enclosureSize,
    reactiveConfig.value.enclosureOpacity
  ],
  () => rig.rebuildEnclosure()
)

const init = async (): Promise<void> => {
  if (!canvas.value) return
  const { setup, animate, scene, camera, renderer, setActiveCamera, world } = await getTools({
    canvas: canvas.value,
    onProgress: handleProgress
  })

  rig.setScene(scene)
  rig.setWorld(world)
  cameraReference = camera
  sceneReference = scene

  const timeline = createTimelineManager()
  rig.setTimeline(timeline)

  const { orbit } = await setup({
    config: RIG_ANIMATOR_SETUP_CONFIG,
    defineSetup: async () => {
      animate({
        beforeTimeline: () => {
          rig.tickPlayback()
          rig.tickPhysics()
          limbCheck.updateCrossings()
        },
        timeline
      })
    }
  })
  orbitReference = orbit

  registerSceneElements(
    camera,
    scene.children.filter((child) => child !== camera),
    undefined,
    {
      renderer,
      orbit,
      setCamera: (newCamera) => {
        cameraReference = newCamera
        updateCameraCentering()
        return setActiveCamera(newCamera)
      }
    }
  )

  reactiveConfig.value.model = DEFAULT_MODEL_PATH
}

/** True while a text or number field elsewhere in the panel has focus, so the timeline's own
 * shortcuts (space, and especially the arrow keys) do not hijack normal field editing. */
const isEditingAFormField = (): boolean => {
  const active = document.activeElement
  return active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement
}

/** Steps the current frame by a delta, clamped to the timeline's own current range. */
const stepFrame = (delta: number): void => {
  moveToFrame(Math.min(Math.max(reactiveConfig.value.frame + delta, 0), rig.frameMax.value))
}

onMounted(async () => {
  await init()
  canvas.value?.addEventListener('pointerdown', onCanvasPointerDown)
  window.addEventListener('resize', updateCameraCentering)
  timelineControls = createControls({
    mapping: RIG_TIMELINE_KEYBOARD_MAPPING,
    onAction: (action) => {
      if (isEditingAFormField()) return
      if (action === 'addKeyframe') rig.addKeyframe()
      else if (action === 'nextFrame') stepFrame(1)
      else if (action === 'previousFrame') stepFrame(-1)
      else if (action === 'extendSelectionNext')
        rigTimelineReference.value?.extendSelectionByFrames(1)
      else if (action === 'extendSelectionPrevious') {
        rigTimelineReference.value?.extendSelectionByFrames(-1)
      }
    }
  })
})

onUnmounted(() => {
  canvas.value?.removeEventListener('pointerdown', onCanvasPointerDown)
  window.removeEventListener('resize', updateCameraCentering)
  onWindowPointerUp()
  timelineControls?.destroyControls()
  rig.clearPhysics()
  clearSceneElements()
})
</script>

<template>
  <canvas ref="canvas"></canvas>
  <LoadingOverlay :visible="loadingVisible" :stage="loadingStage" :detail="loadingDetail" />
  <div class="rig-canvas-controls">
    <input
      ref="modelFileInput"
      type="file"
      :accept="MODEL_FILE_ACCEPT"
      class="rig-canvas-controls__hidden-input"
      @change="handleModelFileChange"
    />
    <IconButton size="sm" variant="outline" title="Upload Model" @click="modelFileInput?.click()">
      <Upload />
    </IconButton>
    <IconButton
      v-if="rig.boneNames.value.length > 0"
      size="sm"
      variant="outline"
      :active="reactiveConfig.showBoneMarkers"
      :title="reactiveConfig.showBoneMarkers ? 'Hide Bone Markers' : 'Show Bone Markers'"
      @click="reactiveConfig.showBoneMarkers = !reactiveConfig.showBoneMarkers"
    >
      <Bone />
    </IconButton>
    <IconButton
      v-if="rig.boneNames.value.length > 0"
      size="sm"
      variant="outline"
      :active="showLimbCheck"
      :title="showLimbCheck ? 'Stop Checking Limbs' : 'Check Limbs While Posing'"
      @click="toggleLimbCheck"
    >
      <Ruler />
    </IconButton>
    <IconButton
      size="sm"
      variant="outline"
      :active="showRigPanel"
      :title="showRigPanel ? 'Hide Rig Panel' : 'Show Rig Panel'"
      @click="toggleRigPanel"
    >
      <Settings />
    </IconButton>
    <IconButton
      v-if="rig.canCaptureFromCamera.value"
      size="sm"
      variant="outline"
      :active="cameraCaptureReference?.isCameraActive"
      :title="
        cameraCaptureReference?.isCameraActive ? 'Stop Camera Tracking' : 'Start Camera Tracking'
      "
      @click="toggleCameraTracking"
    >
      <CameraIcon />
    </IconButton>
    <IconButton
      v-if="showRigPanel && cameraCaptureReference?.canRecord"
      size="sm"
      variant="outline"
      class="rig-canvas-controls__record"
      :active="motionRecording.isRecording.value"
      :title="motionRecording.isRecording.value ? 'Stop Recording' : 'Record Motion'"
      @click="cameraCaptureReference?.toggleRecord()"
    >
      <Square v-if="motionRecording.isRecording.value" fill="currentColor" />
      <Circle v-else fill="currentColor" />
    </IconButton>
    <IconButton
      v-if="showRigPanel"
      size="sm"
      variant="outline"
      :active="reactiveConfig.cameraShowPreview"
      :title="reactiveConfig.cameraShowPreview ? 'Hide Camera Preview' : 'Show Camera Preview'"
      @click="reactiveConfig.cameraShowPreview = !reactiveConfig.cameraShowPreview"
    >
      <Eye />
    </IconButton>
    <IconButton
      size="sm"
      variant="outline"
      :active="reactiveConfig.physicsEnabled"
      :title="reactiveConfig.physicsEnabled ? 'Disable Physics' : 'Enable Physics'"
      @click="togglePhysics"
    >
      <Lightbulb />
    </IconButton>
    <IconButton
      v-if="reactiveConfig.physicsEnabled"
      size="sm"
      variant="outline"
      :active="reactiveConfig.marbleFlowEnabled"
      :title="reactiveConfig.marbleFlowEnabled ? 'Stop Marble Flow' : 'Start Marble Flow'"
      @click="toggleMarbleFlow"
    >
      <Circle />
    </IconButton>
  </div>
  <!-- Named as limbs meeting rather than as landmarks: what is wrong is how far the rig
       reaches, and the pose is only how that shows. -->
  <ul v-if="showLimbCheck && limbCheck.crossings.value.length > 0" class="rig-bone-crossings">
    <li v-for="crossing in limbCheck.crossings.value" :key="crossing">{{ crossing }}</li>
  </ul>
  <MergeTargetDiagram
    v-if="showRigPanel"
    class="rig-merge-target-diagram"
    :active-groups="targetBodyPartGroups"
    @toggle-group="handleToggleBodyPartGroup"
  />
  <RigTimeline
    ref="rigTimelineReference"
    :frame="reactiveConfig.frame"
    :frame-max="rig.frameMax.value"
    :keyframe-frames="rig.keyframeFrames.value"
    :is-playing="rig.isPlaying.value"
    :has-clipboard="rig.hasClipboard.value"
    :can-apply-hand-pose="rig.canApplyHandPose.value"
    :recorded-presets="rig.recordedPresets.value"
    @update:frame="moveToFrame"
    @update:frame-max="rig.setFrameMax"
    @add-keyframe="rig.addKeyframe"
    @delete-keyframes="rig.deleteKeyframesAt"
    @copy-keyframes="rig.copyKeyframes"
    @paste-keyframes="rig.pasteKeyframes"
    @select-hand-pose="rig.applyHandPosePreset"
    @move-keyframes="rig.moveKeyframesBy"
    @remove-frame-range="rig.removeFrameRange"
    @insert-frame-range="rig.insertFrameRange"
    @toggle-playback="handleTogglePlayback"
    @import-poses="(url) => (reactiveConfig.poses = url)"
    @export-glb="rig.exportGlb"
    @export-json="rig.exportJson"
    @select-preset="handleSelectPreset"
    @reset-all="rig.resetAutosave"
    @filter-keyframes="rig.filterKeyframes"
    @reduce-keyframes="rig.reduceKeyframes"
  />
  <CameraPoseCapture
    v-if="showRigPanel"
    ref="cameraCaptureReference"
    :video-slowdown-ratio="reactiveConfig.cameraVideoSlowdownRatio"
    :smoothing-settings="cameraSmoothingSettings"
    :detection-options="cameraDetectionOptions"
    :show-preview="reactiveConfig.cameraShowPreview"
    :is-recording="motionRecording.isRecording.value"
    :frame="reactiveConfig.frame"
    :fps="reactiveConfig.fps"
    :target-group-labels="targetBodyPartGroupLabels"
    @apply="handleCameraApply"
    @close="handleCloseCamera"
    @toggle-record="handleToggleRecord"
    @enable-preview="reactiveConfig.cameraShowPreview = true"
    @seek-frame="(frame) => (reactiveConfig.frame = frame)"
  >
    <RigConfigAccordion
      :groups="rigPanelGroups"
      :get-value="readRigSetting"
      :on-update="writeRigSetting"
      :on-action="runRigPanelAction"
    />
  </CameraPoseCapture>
</template>

<style scoped>
canvas {
  display: block;
  width: 100%;
  height: 100vh;
}

.rig-canvas-controls {
  position: fixed;
  top: calc(var(--nav-height) + var(--spacing-3));
  left: var(--spacing-3);
  z-index: var(--z-overlay);
  display: flex;
  gap: var(--spacing-2);
}

.rig-merge-target-diagram {
  position: fixed;
  top: calc(var(--nav-height) + var(--spacing-3) + var(--btn-sm-height) + var(--spacing-3));
  left: var(--spacing-3);
  z-index: var(--z-overlay);
}

/* Centred at the top, the one strip of the canvas nothing else is docked in: the buttons and
   the merge diagram hold the left, the camera preview the right, the timeline the bottom. */
.rig-bone-crossings {
  position: fixed;
  top: calc(var(--nav-height) + var(--spacing-3));
  left: 50%;
  transform: translateX(-50%);
  z-index: var(--z-overlay);
  margin: 0;
  padding: var(--spacing-2) var(--spacing-3);
  list-style: none;
  border-radius: var(--radius-md);

  /* The same dusty rose the selected bone marker is drawn in, so the warning and the bones it
     is about read as one thing. */
  background: rgb(240 168 160 / 85%);
  color: var(--color-foreground);
  font-size: var(--font-size-xs);
  text-align: center;
}

.rig-canvas-controls__record {
  /* A solid red dot is what reads as a record control at a glance, among outline icons. */
  color: var(--color-destructive);
}

.rig-canvas-controls__hidden-input {
  display: none;
}
</style>
