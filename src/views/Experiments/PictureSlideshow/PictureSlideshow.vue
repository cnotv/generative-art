<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import * as THREE from 'three'
import type { LoadProgress } from '@webgamekit/threejs'
import { createControls } from '@webgamekit/controls'
import { createTimelineManager } from '@webgamekit/animation'
import { createReactiveConfig, registerViewConfig, unregisterViewConfig } from '@/stores/viewConfig'
import type { ConfigControlsSchema } from '@/stores/viewConfig'
import { useSceneViewStore } from '@/stores/sceneView'
import { useDebugSceneStore } from '@/stores/debugScene'
import { useElementPropertiesStore } from '@/stores/elementProperties'
import { useTimelinePanelStore } from '@/stores/timelinePanel'
import { characterOptions, despawnSlideshowCharacter, spawnSlideshowCharacter } from './character'
import { createRagdollEditor, RAGDOLL_SCHEMA } from './ragdollEditor'
import type { HandSide, RagdollEditor, RigPosition } from './ragdollEditor'
import LoadingOverlay from '@/components/LoadingOverlay.vue'
import {
  advanceSlideshow,
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
  CANVAS_SIZE,
  CONTROL_MAPPING,
  DEFAULT_BACKGROUND_BLUR,
  DEFAULT_CHARACTER,
  DEFAULT_FRAME_COLOR,
  DEFAULT_HELD_OFFSET,
  DEFAULT_TIMING,
  MIXAMO_CHARACTER,
  PICTURES,
  SETUP_CONFIG,
  VIEW_TARGET,
  configControls
} from './config'

/**
 * A config colour, stored as the hex integer every other numeric colour in this app uses
 * (`0xf3eee8` and so on), read as the CSS string an inline style needs.
 * @param color - The colour, as a 24-bit hex integer
 * @returns The same colour as `#rrggbb`
 */
const numberToHex = (color: number): string => `#${color.toString(16).padStart(6, '0')}`

/**
 * Where a held picture sits and faces: the offset and facing applied on top of wherever
 * the hands currently are, shared by both slots since only one position is ever held at
 * once. Rotation's `x` and `y` are stored here but never applied to the DOM image — see
 * `applyPictureSlot`.
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
// The picture itself is a DOM image rather than a WebGL texture, so it renders at the
// browser's own resolution and colour handling instead of a mesh's. Two slots, never more:
// the change logic only ever has a leaving picture and a held-or-arriving one on screen at
// once, and both are repositioned to the same projected rect every frame.
const leavingPictureElement = ref<HTMLImageElement | null>(null)
const heldPictureElement = ref<HTMLImageElement | null>(null)
const route = useRoute()
const store = useSceneViewStore()
const elementPropertiesStore = useElementPropertiesStore()
const debugSceneStore = useDebugSceneStore()
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
  image: '',
  frame: DEFAULT_FRAME_COLOR
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
      // Pre-allocated scratch for projecting the picture's world rect to the canvas's own
      // screen box every frame; reused rather than allocated so the loop stays allocation-free.
      const pictureCenter = new THREE.Vector3()
      const projectedTopLeft = new THREE.Vector3()
      const projectedBottomRight = new THREE.Vector3()

      // Not a scene child any more — the picture is a DOM image — so the Elements panel
      // never discovers it on its own the way it does a named mesh. addSceneElement is
      // what actually adds the row; registerElementProperties alone only supplies the
      // schema for a row something else already listed.
      debugSceneStore.addSceneElement(
        { name: 'picture', type: 'Group' },
        {
          title: 'Picture',
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
        }
      )

      /**
       * Where the picture's world-space rectangle lands on the canvas's own screen box,
       * in CSS pixels. Every visible picture shares this same rect — only their opacity
       * and source differ — so it is projected once per frame rather than once per slot.
       * @returns The rect, or null before the canvas has a measurable box
       */
      const projectPictureRect = (): {
        left: number
        top: number
        width: number
        height: number
      } | null => {
        const canvasElement = canvas.value
        if (!canvasElement) return null
        const halfWidth = CANVAS_SIZE[0] / 2
        const halfHeight = CANVAS_SIZE[1] / 2
        projectedTopLeft
          .set(pictureCenter.x - halfWidth, pictureCenter.y + halfHeight, pictureCenter.z)
          .project(camera)
        projectedBottomRight
          .set(pictureCenter.x + halfWidth, pictureCenter.y - halfHeight, pictureCenter.z)
          .project(camera)
        const bounds = canvasElement.getBoundingClientRect()
        const left = bounds.left + ((projectedTopLeft.x + 1) / 2) * bounds.width
        const top = bounds.top + ((1 - projectedTopLeft.y) / 2) * bounds.height
        const right = bounds.left + ((projectedBottomRight.x + 1) / 2) * bounds.width
        const bottom = bounds.top + ((1 - projectedBottomRight.y) / 2) * bounds.height
        return { left, top, width: right - left, height: bottom - top }
      }

      /**
       * Places one picture slot at the current rect, or hides it once its index is null.
       * ponytail: only `heldRotation.z` reaches the DOM image; a tilt on x or y still
       * updates the panel's numbers but has nothing left to apply them to, since a CSS
       * rotation cannot reproduce the camera's own perspective on the other two axes.
       * @param imageElement - The `<img>` element this slot owns
       * @param index - Which picture belongs here, or null while nothing does
       * @param opacity - How visible it is this frame
       * @param rect - The projected rect shared by both slots, or null before it exists
       * @param frameColor - The frame border colour, as a CSS hex string
       */
      const applyPictureSlot = (
        imageElement: HTMLImageElement | null,
        index: number | null,
        opacity: number,
        rect: { left: number; top: number; width: number; height: number } | null,
        frameColor: string
      ): void => {
        if (!imageElement) return
        if (index === null || !rect) {
          imageElement.style.opacity = '0'
          return
        }
        const url = reactiveConfig.value.image || PICTURES[index].url
        if (imageElement.src !== url) imageElement.src = url
        imageElement.alt = PICTURES[index].name
        imageElement.style.opacity = String(opacity)
        imageElement.style.left = `${rect.left}px`
        imageElement.style.top = `${rect.top}px`
        imageElement.style.width = `${rect.width}px`
        imageElement.style.height = `${rect.height}px`
        imageElement.style.borderColor = frameColor
        imageElement.style.transform = heldRotation.z ? `rotate(${heldRotation.z}rad)` : ''
      }

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
        ragdollEditor?.dispose()
        elementPropertiesStore.unregisterElementProperties('character')
        debugSceneStore.removeSceneElement('picture')
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
              ? scrubByDrag(slideshow, drag, timing, PICTURES.length)
              : advanceSlideshow(slideshow, delta, timing, PICTURES.length)
          character.mixer?.update(delta)
          const frame = slideshowFrame(slideshow, timing)

          character.pose(frame)
          character.heldPoint(held)
          // A picture never leaves the hands any more — the clip's own drop and pick
          // motion is what carries them — so both slots sit at the same projected rect
          // and only their opacity says whether a change is under way.
          pictureCenter.copy(held).add(heldOffset)
          const rect = projectPictureRect()
          const frameColor = numberToHex(reactiveConfig.value.frame)
          applyPictureSlot(
            leavingPictureElement.value,
            frame.leavingIndex,
            1 - exitAmountAt(frame, timing),
            rect,
            frameColor
          )
          applyPictureSlot(
            heldPictureElement.value,
            frame.heldIndex,
            frame.phase === 'arrive' ? 1 - entryAmountAt(frame, timing) : 1,
            rect,
            frameColor
          )
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
  <img ref="leavingPictureElement" class="slideshow-picture" alt="" />
  <img ref="heldPictureElement" class="slideshow-picture" alt="" />
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

.slideshow-picture {
  /* Positioned and sized every frame from the projected 3D anchor, not from layout. */
  position: fixed;
  top: 0;
  left: 0;
  z-index: var(--z-fixed);
  opacity: 0;
  object-fit: cover;

  /* The frame sits inside the projected rect rather than growing past it, so the
     positioning math above still lines up with what's actually drawn on screen.
     Its colour is set inline every frame, from the Config panel's own colour picker. */
  box-sizing: border-box;
  border-width: 0.75rem;
  border-style: solid;
  box-shadow:
    inset 0 0 0 0.125rem rgb(0 0 0 / 35%),
    var(--shadow-xl);

  /* Decorative only: the canvas underneath is the actual control surface. */
  pointer-events: none;
}
</style>
