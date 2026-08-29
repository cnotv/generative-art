<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import * as THREE from 'three'
import { getCube, getModel } from '@webgamekit/threejs'
import type { ComplexModel, LoadProgress } from '@webgamekit/threejs'
import { createControls } from '@webgamekit/controls'
import { createTimelineManager } from '@webgamekit/animation'
import { createReactiveConfig, registerViewConfig, unregisterViewConfig } from '@/stores/viewConfig'
import { useSceneViewStore } from '@/stores/sceneView'
import { characterOptions, despawnSlideshowCharacter, spawnSlideshowCharacter } from './character'
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
import type { SlideDirection, SlideshowCharacter, SlideshowState } from './types'
import {
  CANVAS_DISPLAY_ROTATION,
  CANVAS_ENTRY_DISTANCE,
  CANVAS_ENTRY_DROP,
  CANVAS_MATERIAL,
  CANVAS_SIZE,
  CANVAS_DISPLAY_POSITION,
  CONTROL_MAPPING,
  DEFAULT_CHARACTER,
  DEFAULT_TIMING,
  EXIT_DISTANCE,
  EXIT_DROP,
  EXIT_SPIN,
  PICTURES,
  SETUP_CONFIG,
  VIEW_TARGET,
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
  character: DEFAULT_CHARACTER,
  timing: { ...DEFAULT_TIMING },
  exit: { distance: EXIT_DISTANCE, drop: EXIT_DROP, spin: EXIT_SPIN }
})

/** Set once the scene exists, so a panel change can rebuild the character. */
let swapCharacter: ((characterId: string) => Promise<void>) | null = null
let spawnedCharacter = DEFAULT_CHARACTER

/** Rebuild only when the choice actually changed: every slider fires this too. */
const handleConfigChange = (): void => {
  const wanted = reactiveConfig.value.character
  if (wanted === spawnedCharacter || !swapCharacter) return
  spawnedCharacter = wanted
  void swapCharacter(wanted)
}

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
  registerViewConfig(
    route.name as string,
    reactiveConfig,
    // The character row is assembled here rather than in the config, which holds
    // only literal values; its options come from the shared skin catalogue.
    { character: { label: 'Character', options: characterOptions() }, ...configControls },
    handleConfigChange
  )
  // The canvas fills the viewport, and it is the element whose halves decide
  // whether a tap means forward or back.
  destroyControls = createControls({
    mapping: CONTROL_MAPPING,
    pointerTarget: canvas.value,
    onAction: (action) => requestChange(action === 'previous' ? -1 : 1)
  }).destroyControls

  // Orbit is disabled but still aims the camera at its target on the first update,
  // so the target has to be set or `camera.lookAt` above is overwritten by the origin.
  const setupConfig = {
    ...SETUP_CONFIG,
    orbit: { target: new THREE.Vector3(...VIEW_TARGET), disabled: true }
  }

  await store.init(canvas.value, setupConfig, {
    viewPanels: { showConfig: true, showElements: false },
    onProgress: handleProgress,
    defineSetup: async ({ scene, world, getDelta, animate }) => {
      let character: SlideshowCharacter = await spawnSlideshowCharacter(
        scene,
        world,
        reactiveConfig.value.character
      )
      const canvases = spawnCanvases(scene, world)
      const timelineManager = createTimelineManager()
      // Pre-allocated: written every frame, and the loop allocates nothing.
      const held = new THREE.Vector3()

      swapCharacter = async (characterId: string) => {
        despawnSlideshowCharacter(scene, character)
        character = await spawnSlideshowCharacter(scene, world, characterId)
      }

      timelineManager.addAction({
        name: 'Picture change',
        category: 'animation',
        action: () => {
          const { timing, exit } = reactiveConfig.value
          const delta = getDelta()
          character.mixer?.update(delta)
          slideshow = advanceSlideshow(slideshow, delta, timing, canvases.length)
          const frame = slideshowFrame(slideshow, timing)
          const hold = holdAmountAt(frame)
          const exitAmount = exitAmountAt(frame, timing)

          character.pose(hold)
          character.heldPoint(held)

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
