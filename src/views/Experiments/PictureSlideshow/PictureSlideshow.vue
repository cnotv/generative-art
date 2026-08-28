<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import * as THREE from 'three'
import { getCube, getCylinder, getModel } from '@webgamekit/threejs'
import type { ComplexModel, LoadProgress } from '@webgamekit/threejs'
import { createTimelineManager } from '@webgamekit/animation'
import { createReactiveConfig, registerViewConfig, unregisterViewConfig } from '@/stores/viewConfig'
import { useSceneViewStore } from '@/stores/sceneView'
import { createStickmanPartOffsets, prepareStickmanRig } from '@/utils/stickmanRig'
import LoadingOverlay from '@/components/LoadingOverlay.vue'
import { canvasRoleAt, fallDropAt, fallTumbleAt, liftAmountAt, slideshowFrameAt } from './slideshow'
import {
  ARM_PITCH_DOWN,
  ARM_PITCH_UP,
  CANVAS_DISPLAY_POSITION,
  CANVAS_DISPLAY_ROTATION,
  CANVAS_MATERIAL,
  CANVAS_SIZE,
  CANVAS_WAITING_POSITION,
  CANVAS_WAITING_ROTATION,
  DEFAULT_TIMING,
  FALL_DRIFT,
  FALL_GRAVITY,
  FALL_HIDE_BELOW,
  FALL_SPIN,
  PICTURES,
  PLINTH,
  SETUP_CONFIG,
  STICKMAN_MODEL_PATH,
  STICKMAN_SCALE,
  STICKMAN_YAW,
  configControls
} from './config'

const canvas = ref<HTMLCanvasElement | null>(null)
const route = useRoute()
const store = useSceneViewStore()

const loadingVisible = ref(true)
const loadingStage = ref('Loading…')
const loadingDetail = ref<string | undefined>(undefined)
const handleProgress = (progress: LoadProgress): void => {
  loadingVisible.value = !progress.done
  loadingStage.value = progress.stage
  loadingDetail.value = progress.detail
}

const reactiveConfig = createReactiveConfig({
  timing: { ...DEFAULT_TIMING },
  fall: { gravity: FALL_GRAVITY, drift: FALL_DRIFT, spin: FALL_SPIN },
  arms: { pitchUp: ARM_PITCH_UP, pitchDown: ARM_PITCH_DOWN }
})

const mix = (from: number, to: number, amount: number): number => from + (to - from) * amount

/**
 * Loads the rig, straightens it, stands it on the plinth and hands back the
 * two arm nodes the cycle swings.
 *
 * The rig's own origin is not at its feet, so the height it spawns at says
 * nothing about where it stands; measured after `prepareStickmanRig`, which is
 * what moves the shoulder caps onto the arms so they swing as one piece.
 * @param scene - The scene to add the rig to
 * @param world - The physics world `getModel` needs
 * @returns The arm nodes, in no particular order
 */
const spawnStickman = async (
  scene: THREE.Scene,
  world: Parameters<typeof getModel>[1]
): Promise<THREE.Object3D[]> => {
  const stickman = await getModel(scene, world, STICKMAN_MODEL_PATH, {
    name: 'stickman',
    position: [0, 0, 0],
    scale: [STICKMAN_SCALE, STICKMAN_SCALE, STICKMAN_SCALE],
    rotation: [0, STICKMAN_YAW, 0],
    type: 'fixed',
    hasGravity: false,
    castShadow: true
  })
  const partRig = prepareStickmanRig(stickman, createStickmanPartOffsets())
  const spawnBox = new THREE.Box3().setFromObject(stickman)
  stickman.position.y -= spawnBox.min.y
  return [...partRig.armLeft, ...partRig.armRight].map(({ node }) => node)
}

/**
 * One flat board per picture, textured once at setup.
 *
 * A board per picture rather than a pool of two means no texture is ever
 * swapped mid-run: the cycle only ever decides where each board is and whether
 * it is visible. `origin` is cleared so the positions below read as the board's
 * centre, which is what the animation writes every frame.
 * @param scene - The scene to add the boards to
 * @param world - The physics world `getCube` needs
 * @returns One board per picture, in picture order
 */
const spawnCanvases = (scene: THREE.Scene, world: Parameters<typeof getCube>[1]): ComplexModel[] =>
  PICTURES.map(({ name, url }) =>
    getCube(scene, world, {
      ...CANVAS_MATERIAL,
      name: `picture-${name}`,
      size: CANVAS_SIZE,
      position: CANVAS_WAITING_POSITION,
      rotation: CANVAS_WAITING_ROTATION,
      texture: url,
      origin: {}
    })
  )

onMounted(async () => {
  if (!canvas.value) return
  registerViewConfig(route.name as string, reactiveConfig, configControls)

  await store.init(canvas.value, SETUP_CONFIG, {
    viewPanels: { showConfig: true, showElements: false },
    onProgress: handleProgress,
    defineSetup: async ({ scene, world, getDelta, animate }) => {
      getCylinder(scene, world, PLINTH)
      const arms = await spawnStickman(scene, world)
      const canvases = spawnCanvases(scene, world)
      const timelineManager = createTimelineManager()
      let elapsedSeconds = 0

      timelineManager.addAction({
        name: 'Picture change',
        category: 'animation',
        action: () => {
          const { timing, fall, arms: armConfig } = reactiveConfig.value
          elapsedSeconds += getDelta()
          const frame = slideshowFrameAt(elapsedSeconds, timing, canvases.length)
          const lift = liftAmountAt(frame)

          arms.forEach((arm) => {
            arm.rotation.x = mix(armConfig.pitchDown, armConfig.pitchUp, lift)
          })

          canvases.forEach((picture, index) => {
            const role = canvasRoleAt(frame, index)
            if (role === 'hidden') {
              picture.visible = false
              return
            }
            if (role === 'waiting') {
              picture.visible = true
              picture.position.set(...CANVAS_WAITING_POSITION)
              picture.rotation.set(...CANVAS_WAITING_ROTATION)
              return
            }
            if (role === 'held') {
              picture.visible = true
              picture.position.set(
                mix(CANVAS_WAITING_POSITION[0], CANVAS_DISPLAY_POSITION[0], lift),
                mix(CANVAS_WAITING_POSITION[1], CANVAS_DISPLAY_POSITION[1], lift),
                mix(CANVAS_WAITING_POSITION[2], CANVAS_DISPLAY_POSITION[2], lift)
              )
              picture.rotation.set(
                mix(CANVAS_WAITING_ROTATION[0], CANVAS_DISPLAY_ROTATION[0], lift),
                0,
                0
              )
              return
            }
            const height = CANVAS_DISPLAY_POSITION[1] - fallDropAt(frame.fallSeconds, fall.gravity)
            picture.visible = height > FALL_HIDE_BELOW
            picture.position.set(
              CANVAS_DISPLAY_POSITION[0],
              height,
              CANVAS_DISPLAY_POSITION[2] + frame.fallSeconds * fall.drift
            )
            picture.rotation.set(
              CANVAS_DISPLAY_ROTATION[0] + fallTumbleAt(frame.fallSeconds, fall.spin),
              0,
              0
            )
          })
        }
      })

      animate({ timeline: timelineManager })
    }
  })

  // Scenes open on a moving sky by default, which walks this one through a
  // night the pictures cannot be read in. Stopped before its first frame, so
  // the lights stay the ones declared above; the panel can start it again.
  store.setLightTransitionEnabled(false)
})

onUnmounted(() => {
  store.cleanup()
  unregisterViewConfig(route.name as string)
})
</script>

<template>
  <canvas ref="canvas"></canvas>
  <LoadingOverlay :visible="loadingVisible" :stage="loadingStage" :detail="loadingDetail" />
</template>

<style scoped>
canvas {
  display: block;
  width: 100%;
  height: 100vh;
}
</style>
