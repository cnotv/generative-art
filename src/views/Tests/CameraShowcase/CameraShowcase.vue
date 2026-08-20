<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import * as THREE from 'three'
import {
  getCube,
  setCameraPreset,
  setCameraSide,
  tiltCamera,
  followCameraPlacement,
  cameraPathCreate,
  cameraPathIsActive,
  DEFAULT_FOLLOW_CAMERA,
  CameraPreset,
  CameraSide,
  type CameraPath
} from '@webgamekit/threejs'
import { createTimelineManager } from '@webgamekit/animation'
import { toRaw } from 'vue'
import { registerViewConfig, unregisterViewConfig, createReactiveConfig } from '@/stores/viewConfig'
import { useSceneViewStore } from '@/stores/sceneView'
import {
  setupConfig,
  configControls,
  PILLAR,
  PILLARS,
  TARGET,
  INTRO_PATH,
  INTRO_SECONDS,
  CAMERA_CASE_LABELS
} from './config'
import { trackPose, isFollowCase, toCameraCase } from './cameraShowcase'

const route = useRoute()
const store = useSceneViewStore()
const canvas = ref<HTMLCanvasElement | null>(null)

const reactiveConfig = createReactiveConfig({
  camera: {
    case: 'third',
    preset: CameraPreset.Perspective,
    side: CameraSide.CameraLeft,
    tilt: 0
  }
})

const activeLabel = ref(CAMERA_CASE_LABELS.third)

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

  if (selected === 'preset' && camera instanceof THREE.PerspectiveCamera) {
    setCameraPreset(
      camera,
      reactiveConfig.value.camera.preset as CameraPreset,
      window.innerWidth / window.innerHeight
    )
    lookTarget.copy(ORIGIN)
  }

  if (selected === 'side' && camera instanceof THREE.PerspectiveCamera) {
    setCameraSide(camera, camera.position, reactiveConfig.value.camera.side as CameraSide)
    lookTarget.copy(ORIGIN)
  }
}

watch(
  () => reactiveConfig.value.camera.case,
  (value) => {
    const selected = toCameraCase(value)
    activeLabel.value = CAMERA_CASE_LABELS[selected]

    if (selected !== 'path') introPath?.cancel()
    if (selected === 'path') startIntroPath()
    applyPlacement()
  }
)

watch(
  () => [reactiveConfig.value.camera.preset, reactiveConfig.value.camera.side],
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
  introPath?.cancel()
  introPath = null
  target = null
  sceneCamera = null
  unregisterViewConfig(route.name as string)
})
</script>

<template>
  <canvas ref="canvas"></canvas>
  <p class="camera-showcase__label">{{ activeLabel }}</p>
</template>

<style scoped lang="scss">
.camera-showcase__label {
  position: fixed;
  bottom: var(--spacing-md);
  left: var(--spacing-md);
  margin: 0;
  color: var(--color-text-inverse);
  font-size: var(--font-size-sm);
  text-shadow: var(--shadow-text-game);
}
</style>
