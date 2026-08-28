<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import * as THREE from 'three'
import { getCube, getCylinder, getModel } from '@webgamekit/threejs'
import type { ComplexModel, LoadProgress } from '@webgamekit/threejs'
import { createControls } from '@webgamekit/controls'
import { createTimelineManager } from '@webgamekit/animation'
import { createReactiveConfig, registerViewConfig, unregisterViewConfig } from '@/stores/viewConfig'
import { useSceneViewStore } from '@/stores/sceneView'
import { createStickmanPartOffsets, prepareStickmanRig } from '@/utils/stickmanRig'
import LoadingOverlay from '@/components/LoadingOverlay.vue'
import {
  advanceSlideshow,
  canvasRoleAt,
  createSlideshowState,
  exitAmountAt,
  holdAmountAt,
  slideshowFrame,
  startChange
} from './slideshow'
import type { SlideDirection, SlideshowState } from './types'
import {
  ARM_PITCH_DOWN,
  ARM_PITCH_UP,
  ARM_ROLL_DOWN,
  ARM_ROLL_UP,
  CANVAS_DISPLAY_POSITION,
  CANVAS_DISPLAY_ROTATION,
  CANVAS_ENTRY_DISTANCE,
  CANVAS_ENTRY_DROP,
  CANVAS_MATERIAL,
  CANVAS_SIZE,
  CONTROL_MAPPING,
  DEFAULT_TIMING,
  EXIT_DISTANCE,
  EXIT_DROP,
  EXIT_SPIN,
  PICTURES,
  PLINTH,
  SETUP_CONFIG,
  STICKMAN_MODEL_PATH,
  STICKMAN_SCALE,
  STICKMAN_YAW,
  STICKMAN_YAW_SWING,
  UP_AXIS,
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
  exit: { distance: EXIT_DISTANCE, drop: EXIT_DROP, spin: EXIT_SPIN },
  arms: { pitchUp: ARM_PITCH_UP, rollUp: ARM_ROLL_UP }
})

/**
 * The slideshow's own state, deliberately outside Vue.
 *
 * It is written every frame by the animation loop and read nowhere else, so
 * reactivity would buy nothing and cost a dependency notification per frame.
 */
let slideshow: SlideshowState = createSlideshowState()

const requestChange = (direction: SlideDirection): void => {
  slideshow = startChange(slideshow, direction, PICTURES.length)
}

/** Bound in `onMounted`: the pointer target is the canvas, which does not exist before then. */
let destroyControls: (() => void) | null = null

const mix = (from: number, to: number, amount: number): number => from + (to - from) * amount

/**
 * Loads the rig, straightens it, stands it on the plinth and hands back the
 * arm nodes, each paired with the direction it rolls away from the body.
 *
 * The rig's own origin is not at its feet, so the height it spawns at says
 * nothing about where it stands; measured after `prepareStickmanRig`, which is
 * what moves the shoulder caps onto the arms so they swing as one piece. The
 * sign is read from the shoulder's own x rather than the node's name, so a
 * rig that names its sides the other way round still spreads outwards.
 * @param scene - The scene to add the rig to
 * @param world - The physics world `getModel` needs
 * @returns The rig, and its arms with the roll direction each one takes
 */
const spawnStickman = async (
  scene: THREE.Scene,
  world: Parameters<typeof getModel>[1]
): Promise<{ stickman: THREE.Object3D; arms: { node: THREE.Object3D; side: number }[] }> => {
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
  const arms = [...partRig.armLeft, ...partRig.armRight].map(({ node, restPosition }) => ({
    node,
    side: Math.sign(restPosition.x) || 1
  }))
  return { stickman, arms }
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
      position: CANVAS_DISPLAY_POSITION,
      rotation: CANVAS_DISPLAY_ROTATION,
      texture: url,
      origin: {}
    })
  )

onMounted(async () => {
  if (!canvas.value) return
  registerViewConfig(route.name as string, reactiveConfig, configControls)
  // The canvas fills the viewport, and it is the element whose halves decide
  // whether a tap means forward or back.
  destroyControls = createControls({
    mapping: CONTROL_MAPPING,
    pointerTarget: canvas.value,
    onAction: (action) => requestChange(action === 'previous' ? -1 : 1)
  }).destroyControls

  await store.init(canvas.value, SETUP_CONFIG, {
    viewPanels: { showConfig: true, showElements: false },
    onProgress: handleProgress,
    defineSetup: async ({ scene, world, getDelta, animate }) => {
      getCylinder(scene, world, PLINTH)
      const { stickman, arms } = await spawnStickman(scene, world)
      const canvases = spawnCanvases(scene, world)
      const timelineManager = createTimelineManager()

      timelineManager.addAction({
        name: 'Picture change',
        category: 'animation',
        action: () => {
          const { timing, exit, arms: armConfig } = reactiveConfig.value
          slideshow = advanceSlideshow(slideshow, getDelta(), timing, canvases.length)
          const frame = slideshowFrame(slideshow, timing)
          const hold = holdAmountAt(frame)
          const exitAmount = exitAmountAt(frame, timing)

          arms.forEach(({ node, side }) => {
            node.rotation.x = mix(ARM_PITCH_DOWN, armConfig.pitchUp, hold)
            node.rotation.z = side * mix(ARM_ROLL_DOWN, armConfig.rollUp, hold)
          })
          // Turning after the picture being sent away is what makes the change
          // read as one movement rather than two objects passing each other.
          const swing = frame.phase === 'hold' ? 0 : Math.sin(Math.PI * exitAmount)
          stickman.quaternion.setFromAxisAngle(
            UP_AXIS,
            STICKMAN_YAW + frame.direction * STICKMAN_YAW_SWING * swing
          )

          canvases.forEach((picture, index) => {
            const role = canvasRoleAt(frame, index)
            if (role === 'hidden') {
              picture.visible = false
              return
            }
            picture.visible = true
            if (role === 'held') {
              picture.position.set(...CANVAS_DISPLAY_POSITION)
              picture.rotation.set(...CANVAS_DISPLAY_ROTATION)
              return
            }
            if (role === 'arriving') {
              // In from the side opposite the one the old picture left by.
              const entry = -frame.direction * CANVAS_ENTRY_DISTANCE
              picture.position.set(
                mix(entry, CANVAS_DISPLAY_POSITION[0], hold),
                mix(
                  CANVAS_DISPLAY_POSITION[1] + CANVAS_ENTRY_DROP,
                  CANVAS_DISPLAY_POSITION[1],
                  hold
                ),
                CANVAS_DISPLAY_POSITION[2]
              )
              picture.rotation.set(CANVAS_DISPLAY_ROTATION[0], 0, 0)
              return
            }
            picture.position.set(
              CANVAS_DISPLAY_POSITION[0] + frame.direction * exit.distance * exitAmount,
              CANVAS_DISPLAY_POSITION[1] - exit.drop * exitAmount,
              CANVAS_DISPLAY_POSITION[2]
            )
            picture.rotation.set(0, 0, -frame.direction * exit.spin * exitAmount)
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
  destroyControls?.()
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

  /* The whole canvas is the control surface, so a swipe must not be taken as a page scroll. */
  touch-action: none;
}
</style>
