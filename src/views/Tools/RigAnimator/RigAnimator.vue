<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import * as THREE from 'three'
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { getTools } from '@webgamekit/threejs'
import type { LoadProgress } from '@webgamekit/threejs'
import { createTimelineManager } from '@webgamekit/animation'
import { ikFindTwoBoneChain, type TwoBoneIkChain } from '@webgamekit/rig'
import LoadingOverlay from '@/components/LoadingOverlay.vue'
import {
  registerViewConfig,
  unregisterViewConfig,
  updateViewSchema,
  createReactiveConfig
} from '@/stores/viewConfig'
import { useViewPanelsStore } from '@/stores/viewPanels'
import { useDebugSceneStore } from '@/stores/debugScene'
import { RIG_ANIMATOR_SETUP_CONFIG, DEFAULT_FPS, DEFAULT_MODEL_PATH } from './config'
import { buildRigAnimatorSchema } from './panelSchema'
import { useRigAnimator } from './useRigAnimator'
import { frameCameraOnModel } from './cameraFraming'
import { beginBoneDragPlane, boneDragTargetFromEvent } from './boneDragPlane'
import { applyPoleDrag } from './boneDragTarget'
import { loadRigAutosave } from './autosave'
import RigTimeline from './RigTimeline.vue'
import CameraPoseCapture from './CameraPoseCapture.vue'
import type { CameraLandmark } from './cameraPoseMapping'
import type { RigAnimatorConfig } from './types'

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
  showBoneMarkers: true
})

const rig = useRigAnimator(reactiveConfig)
const showCameraCapture = ref(false)

let cameraReference: THREE.Camera | null = null
let orbitReference: OrbitControls | null = null
let hasRestoredAutosave = false
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

/** Rebuilds the panel schema from the rig's current bones and auto-rig state. */
const refreshSchema = (): void => {
  updateViewSchema(
    routeName,
    buildRigAnimatorSchema(
      rig.boneNames.value,
      rig.needsAutoRig.value,
      rig.canCaptureFromCamera.value,
      rig.positionRange.value
    )
  )
}

const handleCameraPoseCaptured = (landmarks: CameraLandmark[]): void => {
  rig.applyCameraPose(landmarks)
  showCameraCapture.value = false
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
  (visible) => rig.setMarkersVisible(visible)
)
watch(
  () => reactiveConfig.value.frame,
  (frame) => {
    // During playback the frame field only displays where tickPlayback already put the
    // mixer; scrubbing it back would fight that same-tick update every frame.
    if (!rig.isPlaying.value) rig.scrubToFrame(frame)
  }
)

const init = async (): Promise<void> => {
  if (!canvas.value) return
  const { setup, animate, scene, camera, renderer, setActiveCamera } = await getTools({
    canvas: canvas.value,
    onProgress: handleProgress
  })

  rig.setScene(scene)
  cameraReference = camera

  const { orbit } = await setup({
    config: RIG_ANIMATOR_SETUP_CONFIG,
    defineSetup: async () => {
      animate({
        beforeTimeline: () => rig.tickPlayback(),
        timeline: createTimelineManager()
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
        return setActiveCamera(newCamera)
      }
    }
  )

  reactiveConfig.value.model = DEFAULT_MODEL_PATH
}

onMounted(async () => {
  setViewPanels({ showConfig: true })
  registerViewConfig(
    routeName,
    reactiveConfig,
    buildRigAnimatorSchema([], false, false, rig.positionRange.value),
    undefined,
    {
      autoRig: () => {
        rig.runAutoRig()
        refreshSchema()
      },
      resetBone: () => {
        rig.resetSelectedBone()
      },
      captureFromCamera: () => {
        showCameraCapture.value = true
      }
    }
  )
  await init()
  canvas.value?.addEventListener('pointerdown', onCanvasPointerDown)
})

onUnmounted(() => {
  canvas.value?.removeEventListener('pointerdown', onCanvasPointerDown)
  onWindowPointerUp()
  unregisterViewConfig(routeName)
  clearViewPanels()
  clearSceneElements()
})
</script>

<template>
  <canvas ref="canvas"></canvas>
  <LoadingOverlay :visible="loadingVisible" :stage="loadingStage" :detail="loadingDetail" />
  <RigTimeline
    :frame="reactiveConfig.frame"
    :frame-max="rig.frameMax.value"
    :keyframe-frames="rig.keyframeFrames.value"
    :is-playing="rig.isPlaying.value"
    :has-clipboard="rig.hasClipboard.value"
    @update:frame="(value) => (reactiveConfig.frame = value)"
    @update:frame-max="rig.setFrameMax"
    @add-keyframe="rig.addKeyframe"
    @delete-keyframe="rig.deleteKeyframe"
    @copy-keyframe="rig.copyKeyframe"
    @paste-keyframe="rig.pasteKeyframe"
    @move-keyframe="rig.moveKeyframe"
    @toggle-playback="rig.togglePlayback"
    @import-poses="(url) => (reactiveConfig.poses = url)"
    @export-glb="rig.exportGlb"
    @export-json="rig.exportJson"
    @select-preset="rig.loadPreset"
    @reset-all="rig.resetAutosave"
  />
  <CameraPoseCapture
    v-if="showCameraCapture"
    @capture="handleCameraPoseCaptured"
    @close="showCameraCapture = false"
  />
</template>

<style scoped>
canvas {
  display: block;
  width: 100%;
  height: 100vh;
}
</style>
