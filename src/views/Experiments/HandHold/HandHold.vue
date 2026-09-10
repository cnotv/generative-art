<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import * as THREE from 'three'
import { getTools } from '@webgamekit/threejs'
import { createTimelineManager } from '@webgamekit/animation'
import { FilesetResolver, HandLandmarker, type NormalizedLandmark } from '@mediapipe/tasks-vision'
import { registerViewConfig, unregisterViewConfig, createReactiveConfig } from '@/stores/viewConfig'
import { useViewPanelsStore } from '@/stores/viewPanels'
import { useDebugSceneStore } from '@/stores/debugScene'
import { stats } from '@/utils/stats'
import { Button } from '@/components/ui/button'
import LoadingOverlay from '@/components/LoadingOverlay.vue'
import {
  HAND_HOLD_SETUP_CONFIG,
  MEDIAPIPE_WASM_BASE_PATH,
  MEDIAPIPE_HAND_MODEL_URL,
  CAMERA_DISTANCE,
  CAMERA_FOV,
  ITEM_BASE_SCALE,
  REFERENCE_HAND_SPAN,
  HAND_DISTANCE_SCALE_RANGE,
  defaultConfigValues,
  configControls
} from './config'
import { createHeldItemsSystem, mirroredImagePointToWorld, ITEM_BUILDERS } from './helpers/items'
import {
  handOpenness,
  handPalmCenter,
  handForwardTarget,
  handSpan,
  createGripTracker,
  resolveHandSide
} from './helpers/gesture'

const HAND_SIDES = ['Left', 'Right'] as const
type HandSide = (typeof HAND_SIDES)[number]

const route = useRoute()
const { setViewPanels, clearViewPanels } = useViewPanelsStore()
const { registerSceneElements, clearSceneElements } = useDebugSceneStore()

const canvas = ref<HTMLCanvasElement | null>(null)
const statsElement = ref<HTMLElement | null>(null)
const video = ref<HTMLVideoElement | null>(null)

const isActive = ref(false)
const isLoadingModel = ref(false)
const cameraError = ref<string | null>(null)

const reactiveConfig = createReactiveConfig(defaultConfigValues)

let handLandmarker: HandLandmarker | null = null
let mediaStream: MediaStream | null = null
let toolsCleanup: (() => void) | null = null
let heldItems: ReturnType<typeof createHeldItemsSystem> | null = null

const handWorldPositions: (THREE.Vector3 | null)[] = HAND_SIDES.map(() => null)
const handPositionScratch = HAND_SIDES.map(() => new THREE.Vector3())
const handForwardScratch = HAND_SIDES.map(() => new THREE.Vector3(0, 1, 0))
const forwardTargetScratch = new THREE.Vector3()
/** True while that hand is currently a closed fist: the moment this turns true is also the
 * moment the held item advances to the next one in the list. */
const handIsGripping: boolean[] = HAND_SIDES.map(() => false)
/** Index into ITEM_BUILDERS for whatever that hand is currently holding, or would hold on its
 * next fist. Starts at -1 so the very first fist lands on item 0. */
const handItemIndex: number[] = HAND_SIDES.map(() => -1)
/** Combined size multiplier for that hand's item: the Config panel's scale times the base
 * size times how close the hand currently looks, so the item tracks the hand's own apparent
 * size instead of staying a fixed world size regardless of how near the camera it is. */
const handScale: number[] = HAND_SIDES.map(() => ITEM_BASE_SCALE)

const gripTrackers: Record<HandSide, ReturnType<typeof createGripTracker>> = {
  Left: createGripTracker(),
  Right: createGripTracker()
}

const detectHands = (nowMs: number, aspect: number): void => {
  if (!handLandmarker || !video.value) return
  const result = handLandmarker.detectForVideo(video.value, nowMs)
  const detectedBySide = new Map<HandSide, NormalizedLandmark[]>()
  result.landmarks.forEach((landmarksForHand, handIndex) => {
    const side = resolveHandSide(result.handedness[handIndex]?.[0]?.categoryName ?? '')
    if (side) detectedBySide.set(side, landmarksForHand)
  })

  HAND_SIDES.forEach((side, slotIndex) => {
    const landmarks = detectedBySide.get(side)
    if (!landmarks) {
      handWorldPositions[slotIndex] = null
      return
    }
    const palm = handPalmCenter(landmarks)
    mirroredImagePointToWorld(
      palm,
      CAMERA_DISTANCE,
      CAMERA_FOV,
      aspect,
      handPositionScratch[slotIndex]
    )
    handWorldPositions[slotIndex] = handPositionScratch[slotIndex]

    mirroredImagePointToWorld(
      handForwardTarget(landmarks),
      CAMERA_DISTANCE,
      CAMERA_FOV,
      aspect,
      forwardTargetScratch
    )
    handForwardScratch[slotIndex]
      .subVectors(forwardTargetScratch, handPositionScratch[slotIndex])
      .normalize()

    const grip = gripTrackers[side].update(handOpenness(landmarks))
    const justClosed = grip === 'fist' && !handIsGripping[slotIndex]
    if (justClosed) {
      handItemIndex[slotIndex] = (handItemIndex[slotIndex] + 1) % ITEM_BUILDERS.length
    }
    handIsGripping[slotIndex] = grip === 'fist'

    const distanceScale = THREE.MathUtils.clamp(
      handSpan(landmarks) / REFERENCE_HAND_SPAN,
      HAND_DISTANCE_SCALE_RANGE.min,
      HAND_DISTANCE_SCALE_RANGE.max
    )
    handScale[slotIndex] = ITEM_BASE_SCALE * distanceScale * reactiveConfig.value.itemScale
  })
}

const initScene = async (): Promise<void> => {
  if (!canvas.value) return
  const { setup, scene, camera, cleanup, animate } = await getTools({
    stats,
    route,
    canvas: canvas.value
  })
  toolsCleanup = cleanup
  const { elements } = await setup({ config: HAND_HOLD_SETUP_CONFIG })
  registerSceneElements(camera, elements)

  heldItems = createHeldItemsSystem(scene, HAND_SIDES.length)

  animate({
    timeline: createTimelineManager(),
    beforeTimeline: () => {
      const nowMs = performance.now()
      if (isActive.value) detectHands(nowMs, (camera as THREE.PerspectiveCamera).aspect)
      heldItems?.update(
        handWorldPositions,
        handForwardScratch,
        handIsGripping,
        handItemIndex,
        handScale
      )
    }
  })
}

const stopCamera = (): void => {
  isActive.value = false
  mediaStream?.getTracks().forEach((track) => track.stop())
  mediaStream = null
  if (video.value) video.value.srcObject = null
  try {
    handLandmarker?.close()
  } catch {
    // Nothing to recover: the landmarker is being thrown away either way.
  }
  handLandmarker = null
}

const startCamera = async (): Promise<void> => {
  if (isActive.value || isLoadingModel.value) return
  cameraError.value = null
  isLoadingModel.value = true
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ video: true })
    if (!video.value) throw new Error('Camera preview is not ready')
    video.value.srcObject = mediaStream
    await video.value.play()

    const fileset = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_BASE_PATH)
    handLandmarker = await HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MEDIAPIPE_HAND_MODEL_URL, delegate: 'CPU' },
      runningMode: 'VIDEO',
      numHands: 2
    })
    isActive.value = true
  } catch (caught) {
    cameraError.value = caught instanceof Error ? caught.message : 'Could not start the camera'
    stopCamera()
  } finally {
    isLoadingModel.value = false
  }
}

onMounted(async () => {
  setViewPanels({ showConfig: true })
  registerViewConfig(route.name as string, reactiveConfig, configControls)
  if (statsElement.value) stats.init(route, statsElement.value)
  await initScene()
})

onUnmounted(() => {
  stopCamera()
  toolsCleanup?.()
  heldItems?.dispose()
  clearSceneElements()
  unregisterViewConfig(route.name as string)
  clearViewPanels()
})
</script>

<template>
  <div class="hand-hold">
    <video ref="video" class="hand-hold__video" autoplay playsinline muted></video>
    <canvas ref="canvas" class="hand-hold__canvas"></canvas>
    <div ref="statsElement" class="hand-hold__stats"></div>
    <p v-if="isActive" class="hand-hold__hint">Make a fist to grab the next item.</p>
    <div v-if="!isActive" class="hand-hold__gate">
      <Button :disabled="isLoadingModel" @click="startCamera">
        {{ isLoadingModel ? 'Starting…' : 'Start camera' }}
      </Button>
      <p v-if="cameraError" class="hand-hold__error">{{ cameraError }}</p>
    </div>
    <LoadingOverlay :visible="isLoadingModel" stage="Loading hand tracking…" />
  </div>
</template>

<style scoped>
.hand-hold {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background: var(--color-background);
}

.hand-hold__video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scaleX(-1);
}

.hand-hold__canvas {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
}

.hand-hold__stats {
  position: absolute;
  top: var(--spacing-2);
  left: var(--spacing-2);
  z-index: var(--z-overlay);
}

.hand-hold__hint {
  position: absolute;
  bottom: var(--spacing-6);
  left: 50%;
  transform: translateX(-50%);
  margin: 0;
  color: var(--color-canvas-overlay-foreground);
  text-shadow: var(--shadow-text-canvas-overlay);
  font-size: var(--font-size-sm);
}

.hand-hold__gate {
  position: absolute;
  inset: 0;
  z-index: var(--z-overlay);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-3);
  background: rgb(0 0 0 / 70%);
  backdrop-filter: blur(4px);
}

.hand-hold__error {
  margin: 0;
  color: var(--color-destructive);
  font-size: var(--font-size-sm);
}
</style>
