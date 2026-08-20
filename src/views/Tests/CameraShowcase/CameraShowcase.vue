<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRaw, watch } from 'vue'
import { useRoute } from 'vue-router'
import * as THREE from 'three'
import {
  getCube,
  setCameraSide,
  tiltCamera,
  followCameraPlacement,
  cameraPathCreate,
  cameraPathIsActive,
  DEFAULT_FOLLOW_CAMERA,
  CameraSide,
  type CameraPath
} from '@webgamekit/threejs'
import { createTimelineManager } from '@webgamekit/animation'
import { createControls } from '@webgamekit/controls'
import { LobbyUIOptionToggle, LobbyUIKeyPill } from '@/components/LobbyUI'
import { registerViewConfig, unregisterViewConfig, createReactiveConfig } from '@/stores/viewConfig'
import { useSceneViewStore } from '@/stores/sceneView'
import {
  setupConfig,
  configControls,
  CONTROLS,
  CASE_BY_ACTION,
  CASE_KEYS,
  CAMERA_CASES,
  PILLAR,
  PILLARS,
  TARGET,
  INTRO_PATH,
  INTRO_SECONDS,
  CAMERA_CASE_LABELS
} from './config'
import { trackPose, isFollowCase, toCameraCase, stepCameraCase } from './cameraShowcase'
import type { CameraCase } from './config'

const route = useRoute()
const store = useSceneViewStore()
const canvas = ref<HTMLCanvasElement | null>(null)

const reactiveConfig = createReactiveConfig({
  camera: {
    case: 'third',
    side: CameraSide.CameraLeft,
    tilt: 0
  }
})

/** The on-screen switcher's options, sharing one source of truth with the panel. */
const caseOptions = CAMERA_CASES.map((value) => ({
  value,
  label: `${CASE_KEYS[value]}  ${CAMERA_CASE_LABELS[value]}`
}))

/** Bound to the overlay toggle; writing it drives the same config the panel writes. */
const selectedCase = computed({
  get: () => toCameraCase(reactiveConfig.value.camera.case),
  set: (value: CameraCase) => {
    reactiveConfig.value.camera.case = value
  }
})

const { destroyControls } = createControls({
  ...CONTROLS,
  onAction: (action: string) => {
    if (action === 'case-next')
      return void (selectedCase.value = stepCameraCase(selectedCase.value, 1))
    if (action === 'case-previous')
      return void (selectedCase.value = stepCameraCase(selectedCase.value, -1))
    const direct = CASE_BY_ACTION[action]
    if (direct) selectedCase.value = direct
  }
})

// Pre-allocated: these are read every frame and the animation loop must not allocate.
const targetPosition = new THREE.Vector3()
const targetDirection = new THREE.Vector3()
const lookTarget = new THREE.Vector3()

/** Where the intro sweep holds its gaze; every point in the path shares this look target. */
const PATH_LOOK_AT = new THREE.Vector3(0, 2, 0)
const ORIGIN = new THREE.Vector3(0, 0, 0)

let target: THREE.Object3D | null = null
let sceneCamera: THREE.Camera | null = null
let introPath: CameraPath | null = null
let elapsedSeconds = 0

/** Restart the cinematic sweep. Selecting the case again replays it. */
const startIntroPath = (): void => {
  if (!sceneCamera) return
  introPath?.cancel()
  introPath = cameraPathCreate(sceneCamera, {
    points: INTRO_PATH,
    seconds: INTRO_SECONDS,
    onComplete: () => {
      introPath = null
    }
  })
}

/**
 * Place the camera once, for the cases that are a placement rather than a per-frame follow.
 */
const applyPlacement = (): void => {
  const camera = sceneCamera
  if (!camera) return
  const selected = toCameraCase(reactiveConfig.value.camera.case)

  if (selected === 'side' && camera instanceof THREE.PerspectiveCamera) {
    setCameraSide(camera, camera.position, reactiveConfig.value.camera.side as CameraSide)
    lookTarget.copy(ORIGIN)
  }
}

watch(
  () => reactiveConfig.value.camera.case,
  (value) => {
    const selected = toCameraCase(value)

    if (selected !== 'path') introPath?.cancel()
    if (selected === 'path') startIntroPath()
    applyPlacement()
  }
)

watch(
  () => reactiveConfig.value.camera.side,
  () => applyPlacement()
)

onMounted(async () => {
  if (!canvas.value) return

  registerViewConfig(route.name as string, reactiveConfig, configControls)

  await store.init(canvas.value, setupConfig, {
    viewPanels: { showConfig: true, showScene: true },
    defineSetup: ({ scene, camera, world, getDelta, animate }) => {
      sceneCamera = camera

      PILLARS.forEach((position) => getCube(scene, world, { ...PILLAR, position }))
      target = getCube(scene, world, TARGET)

      const timeline = createTimelineManager()

      timeline.addAction({
        name: 'drive the target around the track',
        category: 'game-logic',
        action: () => {
          if (!target) return
          elapsedSeconds += getDelta()

          const pose = trackPose(elapsedSeconds)
          target.position.set(...pose.position)
          targetPosition.set(...pose.position)
          targetDirection.set(...pose.direction)
          target.lookAt(
            targetPosition.x + targetDirection.x,
            targetPosition.y,
            targetPosition.z + targetDirection.z
          )
        }
      })

      timeline.addAction({
        name: 'apply the selected camera case',
        category: 'visual',
        action: () => {
          // A running path owns the camera; every other case stands down until it finishes.
          const pathOwnsCamera = introPath?.update(getDelta()) === true
          if (pathOwnsCamera) lookTarget.copy(PATH_LOOK_AT)

          if (!pathOwnsCamera && !cameraPathIsActive()) {
            const selected = toCameraCase(reactiveConfig.value.camera.case)
            if (isFollowCase(selected)) {
              const placement = followCameraPlacement(
                selected,
                targetPosition,
                targetDirection,
                DEFAULT_FOLLOW_CAMERA
              )
              camera.position.copy(placement.position)
              lookTarget.copy(placement.lookAt)
            }
          }

          // orbit.update() runs after this action and aims the camera at its target, so the
          // aim has to be expressed there rather than through camera.lookAt.
          const orbit = toRaw(store.orbitReference)
          if (orbit) orbit.target.copy(lookTarget)
          else camera.lookAt(lookTarget)

          if (reactiveConfig.value.camera.tilt !== 0)
            tiltCamera(camera, reactiveConfig.value.camera.tilt)
        }
      })

      animate({ timeline })
    }
  })
})

onUnmounted(() => {
  destroyControls()
  introPath?.cancel()
  introPath = null
  target = null
  sceneCamera = null
  unregisterViewConfig(route.name as string)
})
</script>

<template>
  <canvas ref="canvas"></canvas>
  <div class="camera-showcase__hud">
    <LobbyUIOptionToggle v-model="selectedCase" :options="caseOptions" size="sm" />
    <LobbyUIKeyPill :keyboard="['1', '5', 'Q', 'E']" :gamepad="['l1', 'r1']" />
  </div>
</template>

<style scoped lang="scss">
.camera-showcase__hud {
  position: fixed;
  bottom: var(--spacing-4);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-2);
}
</style>
