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
  HAND_FIRE_SETUP_CONFIG,
  MEDIAPIPE_WASM_BASE_PATH,
  MEDIAPIPE_HAND_MODEL_URL,
  CAMERA_DISTANCE,
  CAMERA_FOV,
  FLAME_PARTICLES_PER_HAND,
  MAX_FIREBALLS,
  FIREBALL_PARTICLES_PER_BALL,
  FIREBALL_LIFETIME_MS,
  AMBIENT_EMBER_COUNT,
  AMBIENT_EMBER_BOUNDS,
  SPARK_POOL_SIZE,
  SPARK_BURST_COUNT,
  SPARK_LIFETIME_MS,
  FLAME_BURST_DURATION_MS,
  FLAME_BURST_FLARE_BOOST,
  FIST_OPENNESS_THRESHOLD,
  OPEN_OPENNESS_THRESHOLD,
  defaultConfigValues,
  configControls
} from './config'
import {
  createHandFlameSystem,
  createFireballSystem,
  createSparkSystem,
  createEmberField,
  mirroredImagePointToWorld
} from './helpers/flames'
import {
  handOpenness,
  handPalmCenter,
  handPointingTarget,
  createGestureTracker,
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
let handFlames: ReturnType<typeof createHandFlameSystem> | null = null
let fireballs: ReturnType<typeof createFireballSystem> | null = null
let sparks: ReturnType<typeof createSparkSystem> | null = null
let embers: ReturnType<typeof createEmberField> | null = null

const handWorldPositions: (THREE.Vector3 | null)[] = HAND_SIDES.map(() => null)
const handPositionScratch = HAND_SIDES.map(() => new THREE.Vector3())
/** How lit each hand's flame is right now: near 0 reads as smoke, 1 as a steady open-hand
 * flame. Purely a function of the current grip, so it never needs a burst added on top. */
const handWarmth: number[] = HAND_SIDES.map(() => 0)
/** Extra size/brightness on top of the steady flame, decaying to 0 over the burst window
 * right after a throw: this, not warmth, is what makes the burst actually visible. */
const handFlareBoost: number[] = HAND_SIDES.map(() => 0)
const handBurstUntilMs: number[] = HAND_SIDES.map(() => 0)
const originScratch = new THREE.Vector3()
const aimTargetScratch = new THREE.Vector3()
const aimDirectionScratch = new THREE.Vector3()

const gestureTrackers: Record<HandSide, ReturnType<typeof createGestureTracker>> = {
  Left: createGestureTracker(),
  Right: createGestureTracker()
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

    const openness = handOpenness(landmarks)
    handWarmth[slotIndex] = THREE.MathUtils.smoothstep(
      openness,
      FIST_OPENNESS_THRESHOLD,
      OPEN_OPENNESS_THRESHOLD
    )
    const burstFraction = Math.max(handBurstUntilMs[slotIndex] - nowMs, 0) / FLAME_BURST_DURATION_MS
    handFlareBoost[slotIndex] = FLAME_BURST_FLARE_BOOST * burstFraction

    const cooldownMs = reactiveConfig.value.fireballCooldownSeconds * 1000
    const threw = gestureTrackers[side].update(openness, nowMs, cooldownMs)
    if (threw && fireballs) {
      handBurstUntilMs[slotIndex] = nowMs + FLAME_BURST_DURATION_MS
      mirroredImagePointToWorld(palm, CAMERA_DISTANCE, CAMERA_FOV, aspect, originScratch)
      mirroredImagePointToWorld(
        handPointingTarget(landmarks),
        CAMERA_DISTANCE,
        CAMERA_FOV,
        aspect,
        aimTargetScratch
      )
      aimDirectionScratch.subVectors(aimTargetScratch, originScratch)
      fireballs.spawn(originScratch, aimDirectionScratch, reactiveConfig.value.fireballSpeed, nowMs)
      sparks?.burst(handPositionScratch[slotIndex], SPARK_BURST_COUNT, nowMs)
    }
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
  const { elements } = await setup({ config: HAND_FIRE_SETUP_CONFIG })
  registerSceneElements(camera, elements)

  handFlames = createHandFlameSystem(scene, HAND_SIDES.length, FLAME_PARTICLES_PER_HAND)
  fireballs = createFireballSystem(scene, MAX_FIREBALLS, FIREBALL_PARTICLES_PER_BALL)
  sparks = createSparkSystem(scene, SPARK_POOL_SIZE)
  embers = createEmberField(scene, AMBIENT_EMBER_COUNT, AMBIENT_EMBER_BOUNDS)

  animate({
    timeline: createTimelineManager(),
    beforeTimeline: () => {
      const nowMs = performance.now()
      if (isActive.value) detectHands(nowMs, (camera as THREE.PerspectiveCamera).aspect)
      handFlames?.update(
        nowMs / 1000,
        handWorldPositions,
        reactiveConfig.value.flameIntensity,
        handWarmth,
        handFlareBoost
      )
      fireballs?.update(nowMs, FIREBALL_LIFETIME_MS)
      sparks?.update(nowMs, SPARK_LIFETIME_MS)
      embers?.update(nowMs / 1000)
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
  handFlames?.dispose()
  fireballs?.dispose()
  sparks?.dispose()
  embers?.dispose()
  clearSceneElements()
  unregisterViewConfig(route.name as string)
  clearViewPanels()
})
</script>

<template>
  <div class="hand-fire">
    <video ref="video" class="hand-fire__video" autoplay playsinline muted></video>
    <canvas ref="canvas" class="hand-fire__canvas"></canvas>
    <div ref="statsElement" class="hand-fire__stats"></div>
    <p v-if="isActive" class="hand-fire__hint">Make a fist, then open it to throw fire.</p>
    <div v-if="!isActive" class="hand-fire__gate">
      <Button :disabled="isLoadingModel" @click="startCamera">
        {{ isLoadingModel ? 'Starting…' : 'Start camera' }}
      </Button>
      <p v-if="cameraError" class="hand-fire__error">{{ cameraError }}</p>
    </div>
    <LoadingOverlay :visible="isLoadingModel" stage="Loading hand tracking…" />
  </div>
</template>

<style scoped>
.hand-fire {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background: var(--color-background);
}

.hand-fire__video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scaleX(-1);
}

.hand-fire__canvas {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
}

.hand-fire__stats {
  position: absolute;
  top: var(--spacing-2);
  left: var(--spacing-2);
  z-index: var(--z-overlay);
}

.hand-fire__hint {
  position: absolute;
  bottom: var(--spacing-6);
  left: 50%;
  transform: translateX(-50%);
  margin: 0;
  color: var(--color-canvas-overlay-foreground);
  text-shadow: var(--shadow-text-canvas-overlay);
  font-size: var(--font-size-sm);
}

.hand-fire__gate {
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

.hand-fire__error {
  margin: 0;
  color: var(--color-destructive);
  font-size: var(--font-size-sm);
}
</style>
