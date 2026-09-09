<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import * as THREE from 'three'
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { getTools } from '@webgamekit/threejs'
import type { LoadProgress } from '@webgamekit/threejs'
import { createTimelineManager } from '@webgamekit/animation'
import { createControls } from '@webgamekit/controls'
import {
  ikFindTwoBoneChain,
  ikTwistAroundWorldAxis,
  applyHandPose,
  applyHandOrientation,
  type TwoBoneIkChain,
  type HandSide,
  type HandPoseDefinition,
  type HandOrientation
} from '@webgamekit/rig'
import { Upload, Camera as CameraIcon, Lightbulb, Circle } from 'lucide-vue-next'
import LoadingOverlay from '@/components/LoadingOverlay.vue'
import IconButton from '@/components/IconButton.vue'
import {
  registerViewConfig,
  unregisterViewConfig,
  updateViewSchema,
  createReactiveConfig
} from '@/stores/viewConfig'
import { useViewPanelsStore } from '@/stores/viewPanels'
import { useDebugSceneStore } from '@/stores/debugScene'
import {
  RIG_ANIMATOR_SETUP_CONFIG,
  DEFAULT_FPS,
  DEFAULT_MODEL_PATH,
  MODEL_FILE_ACCEPT,
  CAMERA_PANEL_WIDTH_VW,
  CAMERA_LANDMARK_SMOOTHING_FACTOR,
  CAMERA_LANDMARK_MAX_JUMP_METERS,
  CAMERA_HAND_SENSITIVITY_DEFAULT,
  RIG_TIMELINE_KEYBOARD_MAPPING,
  DEFAULT_MARBLE_SPAWN_INTERVAL_FRAMES,
  DEFAULT_ENCLOSURE_SIZE_FRACTION,
  DEFAULT_ENCLOSURE_OPACITY
} from './config'
import { buildRigAnimatorSchema } from './panelSchema'
import { useRigAnimator } from './useRigAnimator'
import { useRigMotionRecording } from './useRigMotionRecording'
import { frameCameraOnModel } from './cameraFraming'
import {
  estimateCameraYaw,
  CAMERA_POSE_TORQUE_BONE,
  type CameraLandmark
} from './cameraPoseMapping'
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
import type { RigAnimatorConfig } from './types'

/** The torso torque's own twist axis: straight up, regardless of whatever the model's own
 * current orientation happens to be. */
const WORLD_UP_AXIS = new THREE.Vector3(0, 1, 0)

const route = useRoute()
const routeName = route.name as string
const { setViewPanels, clearViewPanels } = useViewPanelsStore()
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
  cameraUseElbows: true,
  cameraUseKnees: true,
  cameraUseNeck: true,
  cameraUseHips: false,
  cameraUseDepth: true,
  cameraReachMultiplier: 1,
  cameraSmoothingFactor: CAMERA_LANDMARK_SMOOTHING_FACTOR,
  cameraMaxJump: CAMERA_LANDMARK_MAX_JUMP_METERS,
  cameraHandSensitivity: CAMERA_HAND_SENSITIVITY_DEFAULT,
  cameraShowPreview: false,
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

const cameraPoseMappingOptions = computed(() => ({
  includeElbows: reactiveConfig.value.cameraUseElbows,
  includeKnees: reactiveConfig.value.cameraUseKnees,
  includeNeck: reactiveConfig.value.cameraUseNeck,
  includeHips: reactiveConfig.value.cameraUseHips,
  includeDepth: reactiveConfig.value.cameraUseDepth,
  reachMultiplier: reactiveConfig.value.cameraReachMultiplier
}))

/** Which body-part groups the next capture, photo or preset is allowed to touch, read from the
 * Merge Target diagram's own toggled regions; see `bodyPartGroups.ts`. */
const targetBodyPartGroups = computed(() => selectedBodyPartGroups(reactiveConfig.value))
const targetBodyPartGroupLabels = computed(() =>
  [...targetBodyPartGroups.value].map((group) => RIG_BODY_PART_GROUP_LABELS[group])
)

const rig = useRigAnimator(reactiveConfig)
const showCameraCapture = ref(false)
const modelFileInput = ref<HTMLInputElement | null>(null)
const rigTimelineReference = ref<InstanceType<typeof RigTimeline> | null>(null)
const motionRecording = useRigMotionRecording({
  fps: () => reactiveConfig.value.fps,
  currentFrame: () => reactiveConfig.value.frame,
  frameMax: () => rig.frameMax.value,
  setFrame: (frame) => (reactiveConfig.value.frame = frame),
  setFrameMax: (frameMax) => rig.setFrameMax(frameMax),
  // Silent: rebuilding the preview clip and persisting on every one of a fast burst of
  // sampled frames made each capture slower than the last (see captureKeyframeSilently's own
  // doc comment) and was the actual cause of the stutter recording had — not the camera feed
  // itself. stopRecordingAndCommit below pays that cost once, when the burst ends.
  addKeyframe: () => rig.captureKeyframeSilently()
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

/**
 * Shifts the camera's view offset so the model appears centered in the visible half of the
 * canvas while the camera/photo panel covers the other half, rather than sitting off-center
 * against the divider. The canvas itself never resizes for this: `setViewOffset` shifts which
 * part of a wider virtual frame the same render shows, so the shared package's window-based
 * resize handling elsewhere never needs to know about the docked panel at all.
 */
const updateCameraCentering = (): void => {
  const activeCamera = cameraReference
  if (!canvas.value) return
  if (
    !(activeCamera instanceof THREE.PerspectiveCamera) &&
    !(activeCamera instanceof THREE.OrthographicCamera)
  ) {
    return
  }
  const width = canvas.value.clientWidth
  const height = canvas.value.clientHeight
  // Hiding the preview shrinks the docked panel down to its action buttons, leaving the model
  // the full canvas to sit in; only a visible preview actually covers half the screen.
  if (showCameraCapture.value && reactiveConfig.value.cameraShowPreview) {
    const visibleWidth = width * (1 - CAMERA_PANEL_WIDTH_VW / 100)
    activeCamera.setViewOffset(width * 2, height, width - visibleWidth / 2, 0, width, height)
  } else {
    activeCamera.clearViewOffset()
  }
  activeCamera.updateProjectionMatrix()
}

/** Rebuilds the panel schema from the rig's current bones and auto-rig state. */
const refreshSchema = (): void => {
  updateViewSchema(
    routeName,
    buildRigAnimatorSchema(
      rig.boneNames.value,
      rig.needsAutoRig.value,
      rig.positionRange.value,
      rig.canCaptureFromCamera.value,
      reactiveConfig.value.physicsEnabled
    )
  )
}

/**
 * Closing the panel only clears the view-offset shift; it does not undo any orbit or pan the
 * user did while the panel was open. Re-framing on close is what actually puts the model back
 * where it started, rather than leaving it wherever the camera was last pointed.
 */
const handleCloseCamera = (): void => {
  showCameraCapture.value = false
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

/** The docked camera icon opens the capture dialog, or closes it again if it is already open. */
const toggleCameraCapture = (): void => {
  if (showCameraCapture.value) handleCloseCamera()
  else showCameraCapture.value = true
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
 * Applies a detected body pose and, riding along on the same emit, any detected hand poses and
 * orientations. Also turns the torso to roughly the angle the photo shows the subject from, the
 * one camera-relative detail a single photo's body landmarks can actually support (see
 * `estimateCameraYaw`'s own doc comment for why not more than that): the upper body twists to
 * follow the subject, hips and feet planted the way a real turn reads, instead of the whole rig
 * spinning like a rigid turntable, and instead of the viewing camera swinging around it, which
 * stays entirely under the user's own orbit control throughout capture.
 *
 * Hand orientation applies last, after the torso twist: `applyHandOrientation` aligns a hand
 * bone to an absolute world direction regardless of whatever rotation it inherited from its
 * now-twisted ancestors, so applying it any earlier would have the twist carry the hand away
 * from the very orientation just set for it.
 *
 * `ikTwistAroundWorldAxis` composes its twist on top of the bone's current orientation rather
 * than setting an absolute one (see its own doc comment), which only stays correct applied
 * fresh every frame because the torso bone is reset to rest first, right below, before
 * `applyCameraPose` gets anywhere near it. The head-aim solve inside that call also resets this
 * same bone (see `applyGizmoDragToChain`'s own doc comment), but only when the head is actually
 * driven that frame; a frame where it isn't (a low-confidence or implausible detection) would
 * otherwise leave the bone exactly where the previous frame's twist left it, and composing
 * another full twist on top of that wound the torso up further every such frame instead of
 * ever settling. Resetting unconditionally here, before either solve runs, means both start
 * from the same fixed baseline regardless of which one actually drove the bone that frame.
 */
const handleCameraApply = (
  landmarks: CameraLandmark[],
  handPoses: Partial<Record<HandSide, HandPoseDefinition>>,
  handOrientations: Partial<Record<HandSide, HandOrientation>>
): void => {
  const restQuaternions = rig.getRestQuaternions()
  const yaw = estimateCameraYaw(landmarks)
  const torsoBone = rig.bones.value.find((bone) => bone.name === CAMERA_POSE_TORQUE_BONE)
  const torsoRestQuaternion = torsoBone && restQuaternions.get(torsoBone.name)
  if (yaw !== null && torsoBone && torsoRestQuaternion) {
    torsoBone.quaternion.copy(torsoRestQuaternion)
  }
  rig.applyCameraPose(landmarks, cameraPoseMappingOptions.value, targetBodyPartGroups.value)
  Object.entries(handPoses).forEach(([side, pose]) => {
    // A hand's fingers belong to that side's arm group (see `boneBodyPartGroup`), so a capture
    // scoped away from that arm must not curl its fingers either.
    const armGroup = side === 'Left' ? 'leftArm' : 'rightArm'
    if (!targetBodyPartGroups.value.has(armGroup)) return
    applyHandPose(rig.bones.value, side as HandSide, pose, restQuaternions)
  })
  if (yaw !== null && torsoBone) {
    ikTwistAroundWorldAxis(torsoBone, yaw, WORLD_UP_AXIS)
  }
  Object.entries(handOrientations).forEach(([side, orientation]) => {
    applyHandOrientation(rig.bones.value, side as HandSide, orientation)
  })
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
    if (rig.model.value && cameraReference) {
      frameCameraOnModel(cameraReference, orbitReference, rig.model.value)
    }
    if (!hasRestoredAutosave) {
      hasRestoredAutosave = true
      const saved = loadRigAutosave()
      if (saved) rig.restoreAutosave(saved)
    }
    refreshSchema()
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
watch(showCameraCapture, () => updateCameraCentering())
watch(
  () => reactiveConfig.value.cameraShowPreview,
  () => updateCameraCentering()
)
watch(
  () => reactiveConfig.value.physicsEnabled,
  () => {
    rig.rebuildPhysics()
    refreshSchema()
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

  const timeline = createTimelineManager()
  rig.setTimeline(timeline)

  const { orbit } = await setup({
    config: RIG_ANIMATOR_SETUP_CONFIG,
    defineSetup: async () => {
      animate({
        beforeTimeline: () => {
          rig.tickPlayback()
          rig.tickPhysics()
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
  reactiveConfig.value.frame = Math.min(
    Math.max(reactiveConfig.value.frame + delta, 0),
    rig.frameMax.value
  )
}

onMounted(async () => {
  setViewPanels({ showConfig: true })
  registerViewConfig(
    routeName,
    reactiveConfig,
    buildRigAnimatorSchema([], false, rig.positionRange.value, false, false),
    undefined,
    {
      autoRig: () => {
        rig.runAutoRig()
        refreshSchema()
      },
      resetBone: () => {
        rig.resetSelectedBone()
      },
      respawnMarbles: () => {
        rig.rebuildMarbles()
      }
    }
  )
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
  unregisterViewConfig(routeName)
  clearViewPanels()
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
      v-if="rig.canCaptureFromCamera.value"
      size="sm"
      variant="outline"
      :title="showCameraCapture ? 'Stop Camera Capture' : 'Capture Pose from Camera'"
      @click="toggleCameraCapture"
    >
      <CameraIcon />
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
  <MergeTargetDiagram
    v-if="showCameraCapture"
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
    @update:frame="(value) => (reactiveConfig.frame = value)"
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
  />
  <CameraPoseCapture
    v-if="showCameraCapture"
    :smoothing-factor="reactiveConfig.cameraSmoothingFactor"
    :max-jump="reactiveConfig.cameraMaxJump"
    :hand-sensitivity="reactiveConfig.cameraHandSensitivity"
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
  />
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

.rig-canvas-controls__hidden-input {
  display: none;
}
</style>
