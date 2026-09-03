<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import * as THREE from 'three'
import { getCube, getModel } from '@webgamekit/threejs'
import type { ComplexModel, LoadProgress } from '@webgamekit/threejs'
import { createControls } from '@webgamekit/controls'
import { createTimelineManager } from '@webgamekit/animation'
import { createReactiveConfig, registerViewConfig, unregisterViewConfig } from '@/stores/viewConfig'
import { useSceneViewStore } from '@/stores/sceneView'
import { useElementPropertiesStore } from '@/stores/elementProperties'
import { useTimelinePanelStore } from '@/stores/timelinePanel'
import { characterOptions, despawnSlideshowCharacter, spawnSlideshowCharacter } from './character'
import { createRagdollEditor, RAGDOLL_SCHEMA } from './ragdollEditor'
import type { HandSide, RagdollEditor, RigPosition } from './ragdollEditor'
import LoadingOverlay from '@/components/LoadingOverlay.vue'
import {
  advanceSlideshow,
  canvasRoleAt,
  createSlideshowState,
  entryAmountAt,
  exitAmountAt,
  slideshowFrame,
  startChange
} from './slideshow'
import type { SlideDirection, SlideshowCharacter, SlideshowState } from './types'
import {
  BACKDROP_URL,
  CANVAS_DISPLAY_ROTATION,
  CANVAS_MATERIAL,
  CANVAS_SIZE,
  CANVAS_DISPLAY_POSITION,
  CONTROL_MAPPING,
  DEFAULT_BACKGROUND_BLUR,
  DEFAULT_CHARACTER,
  DEFAULT_TIMING,
  MIXAMO_CHARACTER,
  PICTURES,
  SETUP_CONFIG,
  VIEW_TARGET,
  configControls
} from './config'

/**
 * The material a picture board was built with, whichever of the shapes `getCube` can
 * return it as. Only ever one plain material here, never an array — this just narrows
 * the type enough to reach `.opacity`.
 * @param picture - The board whose material is read
 * @returns Its material, ready to have `opacity` set on it
 */
const pictureMaterial = (picture: ComplexModel): THREE.Material => {
  const material = (picture as unknown as THREE.Mesh).material
  return Array.isArray(material) ? material[0] : material
}

const canvas = ref<HTMLCanvasElement | null>(null)
const route = useRoute()
const store = useSceneViewStore()
const elementPropertiesStore = useElementPropertiesStore()
const timelinePanelStore = useTimelinePanelStore()

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
  background: { blur: DEFAULT_BACKGROUND_BLUR }
})

/** Set once the scene exists, so a panel change can rebuild the character. */
let swapCharacter: ((characterId: string) => Promise<void>) | null = null
let spawnedCharacter = DEFAULT_CHARACTER

/** Set once the scene exists, so `onUnmounted` can undo the Elements/Timeline registration. */
let disposeRagdollEditor: (() => void) | null = null

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
    viewPanels: { showConfig: true, showElements: true },
    onProgress: handleProgress,
    defineSetup: async ({ scene, world, camera, getDelta, animate }) => {
      let character: SlideshowCharacter = await spawnSlideshowCharacter(
        scene,
        world,
        reactiveConfig.value.character
      )
      const canvases = spawnCanvases(scene, world)
      const timelineManager = createTimelineManager()
      // Pre-allocated: written every frame, and the loop allocates nothing.
      const held = new THREE.Vector3()

      /**
       * Only the Mixamo rig is IK-posed, so only it gets a ragdoll editor. Swapping
       * characters tears down and rebuilds this alongside the model itself.
       */
      let ragdollEditor: RagdollEditor | null = null
      // Read (never written to) inside getValue below, purely so editing the pose from a
      // drag — which touches no Vue state on its own — still marks the panel's displayed
      // numbers stale and worth re-reading.
      const ragdollVersion = ref(0)
      const syncRagdollEditor = (characterId: string): void => {
        ragdollEditor?.dispose()
        ragdollEditor = null
        elementPropertiesStore.unregisterElementProperties('character')
        if (characterId !== MIXAMO_CHARACTER || !canvas.value) return
        ragdollEditor = createRagdollEditor(character.model, camera, canvas.value, scene, () => {
          ragdollVersion.value += 1
        })
        elementPropertiesStore.registerElementProperties('character', {
          title: 'Character',
          schema: RAGDOLL_SCHEMA,
          getValue: (path) => {
            void ragdollVersion.value
            return ragdollEditor?.getRigPosition(path as HandSide) ?? { x: 0, y: 0, z: 0 }
          },
          updateValue: (path, value) =>
            ragdollEditor?.setRigPosition(path as HandSide, value as RigPosition)
        })
      }
      syncRagdollEditor(reactiveConfig.value.character)

      swapCharacter = async (characterId: string) => {
        despawnSlideshowCharacter(scene, character)
        character = await spawnSlideshowCharacter(scene, world, characterId)
        syncRagdollEditor(characterId)
      }

      // Only meaningful while paused: the ragdoll editor writes bone rotations directly,
      // and nothing else drives those bones to fight it while the timeline is stopped.
      let simulationFrame = 0
      timelinePanelStore.register({
        getTimeline: () => timelineManager.getTimeline(),
        getCurrentFrame: () => simulationFrame,
        getFrameRate: () => 1 / 60,
        setActionEnabled: (id, enabled) => timelineManager.updateAction(id, { enabled })
      })
      const stopRagdollWatch = watch(
        () => [elementPropertiesStore.selectedElementName, timelinePanelStore.isPaused] as const,
        ([selectedElementName, isPaused]) =>
          ragdollEditor?.setEnabled(selectedElementName === 'character' && isPaused),
        { immediate: true }
      )
      disposeRagdollEditor = () => {
        stopRagdollWatch()
        ragdollEditor?.dispose()
        elementPropertiesStore.unregisterElementProperties('character')
        timelinePanelStore.unregister()
      }

      timelineManager.addAction({
        name: 'Picture change',
        category: 'animation',
        action: () => {
          simulationFrame += 1
          const { timing } = reactiveConfig.value
          const delta = getDelta()
          character.mixer?.update(delta)
          slideshow = advanceSlideshow(slideshow, delta, timing, canvases.length)
          const frame = slideshowFrame(slideshow, timing)

          character.pose(frame)
          character.heldPoint(held)

          canvases.forEach((picture, index) => {
            const role = canvasRoleAt(frame, index)
            if (role === 'hidden') {
              picture.visible = false
              return
            }
            picture.visible = true
            // A picture never leaves the hands any more — the clip's own drop and pick
            // motion is what carries them — so every visible role sits at the same
            // point and only its opacity says whether a change is under way.
            picture.position.copy(held)
            picture.rotation.set(...CANVAS_DISPLAY_ROTATION)
            pictureMaterial(picture).opacity =
              role === 'leaving'
                ? 1 - exitAmountAt(frame, timing)
                : role === 'arriving'
                  ? 1 - entryAmountAt(frame)
                  : 1
          })
        }
      })

      animate({ timeline: timelineManager, isPaused: () => timelinePanelStore.isPaused })
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
  disposeRagdollEditor?.()
  unregisterViewConfig(route.name as string)
})
</script>

<template>
  <div
    class="backdrop"
    :style="{
      backgroundImage: `url(${BACKDROP_URL})`,
      filter: `blur(${reactiveConfig.background.blur}px)`
    }"
  ></div>
  <canvas ref="canvas"></canvas>
  <LoadingOverlay :visible="loadingVisible" :stage="loadingStage" :detail="loadingDetail" />
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  background-size: cover;
  background-position: center;

  /* Blur samples past its own edge; scaled up, what that reveals is cropped away by the
     viewport instead of showing as a faint halo at the border. */
  transform: scale(1.15);
}

canvas {
  display: block;
  position: relative;
  width: 100%;
  height: 100vh;

  /* Transparent so the backdrop behind it shows through. */
  background: transparent;

  /* The whole canvas is the control surface, so a swipe must not be taken as a page scroll. */
  touch-action: none;
}
</style>
