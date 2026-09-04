<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import * as THREE from 'three'
import { applyTextureToMesh, getCube, getModel } from '@webgamekit/threejs'
import type { ComplexModel, LoadProgress } from '@webgamekit/threejs'
import { createControls } from '@webgamekit/controls'
import { createTimelineManager } from '@webgamekit/animation'
import { createReactiveConfig, registerViewConfig, unregisterViewConfig } from '@/stores/viewConfig'
import type { ConfigControlsSchema } from '@/stores/viewConfig'
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
  scrubByDrag,
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
  DEFAULT_HELD_OFFSET,
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

/**
 * Where a held picture sits and faces, shared by every picture rather than owned by any
 * one of them — there is only ever one held position, wherever the hands currently are,
 * and this is the offset and facing applied on top of it. Registered under each picture's
 * own name so any of them can be selected to reach it, but reading or writing through one
 * reads or writes the same value the others see.
 */
const PICTURE_SCHEMA: ConfigControlsSchema = {
  position: {
    component: 'CoordinateInput',
    label: 'Position',
    min: { x: -5, y: -5, z: -5 },
    max: { x: 5, y: 5, z: 5 },
    step: { x: 0.05, y: 0.05, z: 0.05 }
  },
  rotation: {
    component: 'CoordinateInput',
    label: 'Rotation',
    min: { x: -Math.PI, y: -Math.PI, z: -Math.PI },
    max: { x: Math.PI, y: Math.PI, z: Math.PI },
    step: { x: 0.05, y: 0.05, z: 0.05 }
  }
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
  background: { blur: DEFAULT_BACKGROUND_BLUR },
  // An object URL, applied to whichever picture is currently on display; never a
  // literal default, since there is nothing to preload it from.
  image: ''
})

/** Set once the scene exists, so a panel change can rebuild the character. */
let swapCharacter: ((characterId: string) => Promise<void>) | null = null
let spawnedCharacter = DEFAULT_CHARACTER

/** Set once the scene exists, so `onUnmounted` can undo the Elements/Timeline/watch setup. */
let disposeViewExtras: (() => void) | null = null

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
  slideshow = startChange(slideshow, direction, PICTURES.length, reactiveConfig.value.timing)
}

/** Bound in `onMounted`: the pointer target is the canvas, which does not exist before then. */
let destroyControls: (() => void) | null = null
/** Set alongside `destroyControls`, so the animation loop can read a live drag every frame. */
let getDragProgress: (() => number) | null = null

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
  const controls = createControls({
    mapping: CONTROL_MAPPING,
    pointerTarget: canvas.value,
    onAction: (action) => requestChange(action === 'previous' ? -1 : 1)
  })
  destroyControls = controls.destroyControls
  getDragProgress = controls.pointer.getDragProgress

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
      // Editable from the Elements panel, on top of the hand-tracked `held` point above:
      // an offset rather than an absolute position, since `held` itself moves every frame
      // and a fixed position would either fight it or only hold true for one frame.
      const heldOffset = new THREE.Vector3(...DEFAULT_HELD_OFFSET)
      const heldRotation = new THREE.Vector3(...CANVAS_DISPLAY_ROTATION)
      // Read (never written to) inside getValue below, purely so editing either vector —
      // which touches no Vue state on its own — still marks the panel's displayed
      // numbers stale and worth re-reading.
      const heldTransformVersion = ref(0)

      canvases.forEach((picture) => {
        elementPropertiesStore.registerElementProperties(picture.name, {
          title: picture.name,
          schema: PICTURE_SCHEMA,
          getValue: (path) => {
            void heldTransformVersion.value
            const source = path === 'position' ? heldOffset : heldRotation
            return { x: source.x, y: source.y, z: source.z }
          },
          updateValue: (path, value) => {
            const { x, y, z } = value as RigPosition
            ;(path === 'position' ? heldOffset : heldRotation).set(x, y, z)
            heldTransformVersion.value += 1
          }
        })
      })
      // Every board always carries the same picture, so an upload replaces it on all
      // of them at once — otherwise the boards it missed would resurface it on the
      // very next change, undoing what was just loaded.
      const stopImageWatch = watch(
        () => reactiveConfig.value.image,
        (url) => {
          if (!url) return
          canvases.forEach((picture) => applyTextureToMesh(picture as unknown as THREE.Mesh, url))
        }
      )

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
      disposeViewExtras = () => {
        stopRagdollWatch()
        stopImageWatch()
        ragdollEditor?.dispose()
        elementPropertiesStore.unregisterElementProperties('character')
        canvases.forEach((picture) =>
          elementPropertiesStore.unregisterElementProperties(picture.name)
        )
        timelinePanelStore.unregister()
      }

      timelineManager.addAction({
        name: 'Picture change',
        category: 'animation',
        action: () => {
          simulationFrame += 1
          const { timing } = reactiveConfig.value
          const delta = getDelta()
          const drag = getDragProgress?.() ?? 0
          // A finger in motion sets the change's progress directly, so the hands and the
          // picture track it live; once it lifts, the ordinary timed advance carries
          // whatever is left of the change the rest of the way on its own.
          slideshow =
            drag !== 0
              ? scrubByDrag(slideshow, drag, timing, canvases.length)
              : advanceSlideshow(slideshow, delta, timing, canvases.length)
          character.mixer?.update(delta)
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
            picture.position.copy(held).add(heldOffset)
            picture.rotation.set(heldRotation.x, heldRotation.y, heldRotation.z)
            pictureMaterial(picture).opacity =
              role === 'leaving'
                ? 1 - exitAmountAt(frame, timing)
                : role === 'arriving'
                  ? 1 - entryAmountAt(frame, timing)
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
  disposeViewExtras?.()
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
