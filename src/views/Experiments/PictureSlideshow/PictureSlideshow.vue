<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import * as THREE from 'three'
import { getCube, getModel, getAnimations } from '@webgamekit/threejs'
import type { ComplexModel, LoadProgress } from '@webgamekit/threejs'
import { createControls } from '@webgamekit/controls'
import { createTimelineManager } from '@webgamekit/animation'
import { createReactiveConfig, registerViewConfig, unregisterViewConfig } from '@/stores/viewConfig'
import { useSceneViewStore } from '@/stores/sceneView'
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
  CHARACTER_ANIMATION,
  CHARACTER_HAND_BONES,
  CHARACTER_MODEL_PATH,
  CHARACTER_SCALE,
  CHARACTER_YAW,
  PICTURES,
  SETUP_CONFIG,
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
  exit: { distance: EXIT_DISTANCE, drop: EXIT_DROP, spin: EXIT_SPIN }
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
 * Loads the character, stands its feet on zero and starts its gesture playing.
 *
 * The rig's own origin is not at its feet, so the height it spawns at says
 * nothing about where it stands. Its hands are what the picture is hung from,
 * so they are handed back with it: wherever the clip puts them, the picture
 * follows, which is what keeps the two from ever disagreeing.
 * @param scene - The scene to add the rig to
 * @param world - The physics world `getModel` needs
 * @returns The rig, its animation mixer and the two hand bones
 */
const spawnCharacter = async (
  scene: THREE.Scene,
  world: Parameters<typeof getModel>[1]
): Promise<{
  character: THREE.Object3D
  mixer: THREE.AnimationMixer
  hands: THREE.Object3D[]
}> => {
  const character = await getModel(scene, world, CHARACTER_MODEL_PATH, {
    name: 'character',
    position: [0, 0, 0],
    scale: [CHARACTER_SCALE, CHARACTER_SCALE, CHARACTER_SCALE],
    rotation: [0, CHARACTER_YAW, 0],
    type: 'fixed',
    hasGravity: false,
    castShadow: true,
    material: 'MeshLambertMaterial'
  })
  const spawnBox = new THREE.Box3().setFromObject(character)
  character.position.y -= spawnBox.min.y

  const mixer = new THREE.AnimationMixer(character)
  const actions = await getAnimations(mixer, CHARACTER_ANIMATION)
  Object.values(actions).forEach((action) => action.play())

  const hands = CHARACTER_HAND_BONES.map((name) => character.getObjectByName(name)).filter(
    (node): node is THREE.Object3D => !!node
  )
  return { character, mixer, hands }
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
      const { mixer, hands } = await spawnCharacter(scene, world)
      const canvases = spawnCanvases(scene, world)
      const timelineManager = createTimelineManager()
      // Pre-allocated: the hands are read every frame, and the loop allocates nothing.
      const leftHand = new THREE.Vector3()
      const rightHand = new THREE.Vector3()
      const held = new THREE.Vector3()

      timelineManager.addAction({
        name: 'Picture change',
        category: 'animation',
        action: () => {
          const { timing, exit } = reactiveConfig.value
          const delta = getDelta()
          mixer.update(delta)
          slideshow = advanceSlideshow(slideshow, delta, timing, canvases.length)
          const frame = slideshowFrame(slideshow, timing)
          const hold = holdAmountAt(frame)
          const exitAmount = exitAmountAt(frame, timing)

          // The picture hangs between the hands wherever the clip has put them,
          // but keeps its own facing: a picture that turned with the body would
          // spend half the gesture edge-on to the viewer.
          hands[0].getWorldPosition(leftHand)
          hands[1].getWorldPosition(rightHand)
          held.addVectors(leftHand, rightHand).multiplyScalar(0.5)

          canvases.forEach((picture, index) => {
            const role = canvasRoleAt(frame, index)
            if (role === 'hidden') {
              picture.visible = false
              return
            }
            picture.visible = true
            if (role === 'held') {
              picture.position.copy(held)
              picture.rotation.set(...CANVAS_DISPLAY_ROTATION)
              return
            }
            if (role === 'arriving') {
              // In from the side opposite the one the old picture left by.
              const entry = -frame.direction * CANVAS_ENTRY_DISTANCE
              picture.position.set(
                mix(entry, held.x, hold),
                mix(held.y + CANVAS_ENTRY_DROP, held.y, hold),
                held.z
              )
              picture.rotation.set(CANVAS_DISPLAY_ROTATION[0], 0, 0)
              return
            }
            picture.position.set(
              held.x + frame.direction * exit.distance * exitAmount,
              held.y - exit.drop * exitAmount,
              held.z
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
