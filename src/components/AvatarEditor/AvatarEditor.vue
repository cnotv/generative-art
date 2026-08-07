<script setup lang="ts">
import * as THREE from 'three'
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { getTools, loadGLTF, textureLoader } from '@webgamekit/threejs'
import { updateAnimation } from '@webgamekit/animation'
import type { ComplexModel } from '@webgamekit/animation'
import { storageSaveLocal, storageLoadLocal } from '@webgamekit/canvas-editor'
import lakeUrl from '@/assets/images/backgrounds/lake.webp'
import drawTemplateUrl from '@/assets/images/characters/stickman_draw_template.png'
import { buildMaterial } from '@/utils/materialBuilder'
import { floodFill, cssColorToRgba } from '@/utils/canvasFloodFill'
import { applyStickmanPartOffsets, prepareStickmanRig } from '@/utils/stickmanRig'
import type { StickmanPartRig } from '@/types/stickmanRig'
import type { AvatarEditorConfig } from '@/types/avatarEditor'
import { DrawingToolbar } from '@/components/DrawingToolbar'
import type { DrawingTool } from '@/components/DrawingToolbar'
import {
  MATERIAL_FEATURES,
  DEFAULT_CONFIG,
  getEnabledMaps,
  LIGHT_INTENSITY,
  AMBIENT_LIGHT_INTENSITY,
  HEMISPHERE_SKY,
  HEMISPHERE_GROUND,
  LIGHT_ORBIT_RADIUS,
  LIGHT_Z_POSITION,
  SCENE_BG_COLOR
} from '@/views/Tests/MaterialsList/materialsListConfig'
import {
  AVATAR_MODEL_PATH,
  AVATAR_CANVAS_SIZE,
  AVATAR_FRAME_PADDING,
  AVATAR_ORTHO_NEAR,
  AVATAR_ORTHO_FAR,
  AVATAR_ORTHO_DISTANCE,
  AVATAR_DRAG_SENSITIVITY,
  AVATAR_BRUSH_SIZE_DEFAULT,
  AVATAR_HISTORY_LIMIT,
  AVATAR_WALK_ACTION,
  AVATAR_WALK_SPEED,
  AVATAR_MATERIAL_TYPE,
  AVATAR_MAP_STRENGTHS,
  AVATAR_ALPHA_TEST,
  STORAGE_PREFIX,
  TEXTURE_SLOTS,
  TEXTURE_SLOT_LABELS,
  TEXTURE_SLOT_BASE_COLOR,
  TEXTURE_SLOT_PALETTE,
  TEXTURE_SLOT_DEFAULT_COLOR
} from './config'
import type { TextureSlotKey } from './config'

const props = defineProps<{ config: AvatarEditorConfig }>()

const canvas = ref<HTMLCanvasElement | null>(null)

let avatar: THREE.Object3D | null = null
let partRig: StickmanPartRig | null = null
let envMap: THREE.Texture | null = null
let probeTexture: THREE.Texture | null = null
let orthoCamera: THREE.OrthographicCamera | null = null
let rendererReference: THREE.WebGLRenderer | null = null
let canvasElement: HTMLCanvasElement | null = null
let frameHalfHeight = 1

const animationClock = new THREE.Clock()
const isWalking = ref(false)

const textures: Record<string, THREE.CanvasTexture> = {}
const offscreenCanvases: Record<string, HTMLCanvasElement> = {}

const activeSlot = ref<TextureSlotKey>('diffuse')
const activeTool = ref<DrawingTool>('brush')
const brushColor = ref(TEXTURE_SLOT_DEFAULT_COLOR.diffuse)
const brushSize = ref(AVATAR_BRUSH_SIZE_DEFAULT)

const previewUrls = reactive<Partial<Record<TextureSlotKey, string>>>({})
const updatePreviews = (): void => {
  TEXTURE_SLOTS.forEach((slot) => {
    const offscreen = offscreenCanvases[slot]
    if (!offscreen) return
    previewUrls[slot] = offscreen.toDataURL()
  })
}

type ActiveMode = 'paint' | 'rotate' | 'none'
let activeMode: ActiveMode = 'none'
let lastPaintUv: THREE.Vector2 | null = null
let didPaint = false
let dragLastX = 0
let dragLastY = 0

const paintHistory = reactive<Record<TextureSlotKey, { stack: string[]; index: number }>>(
  Object.fromEntries(
    TEXTURE_SLOTS.map((slot) => [slot, { stack: [] as string[], index: -1 }])
  ) as Record<TextureSlotKey, { stack: string[]; index: number }>
)
const canUndo = computed(() => paintHistory[activeSlot.value].index > 0)
const canRedo = computed(() => {
  const history = paintHistory[activeSlot.value]
  return history.index < history.stack.length - 1
})

watch(activeSlot, (slot) => {
  const palette = TEXTURE_SLOT_PALETTE[slot]
  if (!palette.includes(brushColor.value)) brushColor.value = palette[0]
})

const storageKey = (slot: TextureSlotKey): string => `${STORAGE_PREFIX}-${slot}`

const applyDataUrlToCanvas = (offscreen: HTMLCanvasElement, dataUrl: string): Promise<void> =>
  new Promise((resolve) => {
    const image = new Image()
    image.onload = () => {
      const context = offscreen.getContext('2d')!
      context.clearRect(0, 0, offscreen.width, offscreen.height)
      context.drawImage(image, 0, 0, offscreen.width, offscreen.height)
      resolve()
    }
    image.onerror = () => resolve()
    image.src = dataUrl
  })

const fillSlotCanvas = async (
  slot: TextureSlotKey,
  offscreen: HTMLCanvasElement
): Promise<void> => {
  const context = offscreen.getContext('2d')!
  context.globalCompositeOperation = 'source-over'
  context.clearRect(0, 0, offscreen.width, offscreen.height)
  context.fillStyle = TEXTURE_SLOT_BASE_COLOR[slot]
  context.fillRect(0, 0, offscreen.width, offscreen.height)
  // The template is the rig's own body laid out in the same front/back
  // projection the painting raycast reads, so its outline lands exactly where
  // the limbs are — without it there is nothing on the canvas to aim at.
  if (slot === 'diffuse') await applyDataUrlToCanvas(offscreen, drawTemplateUrl)
}

const createSlotCanvas = async (slot: TextureSlotKey): Promise<HTMLCanvasElement> => {
  const offscreen = document.createElement('canvas')
  offscreen.width = AVATAR_CANVAS_SIZE
  offscreen.height = AVATAR_CANVAS_SIZE
  await fillSlotCanvas(slot, offscreen)
  return offscreen
}

const initTextures = async (): Promise<void> => {
  await Promise.all(
    TEXTURE_SLOTS.map(async (slot) => {
      const offscreen = await createSlotCanvas(slot)
      const saved = storageLoadLocal(storageKey(slot))
      if (saved?.dataUrl) await applyDataUrlToCanvas(offscreen, saved.dataUrl)
      offscreenCanvases[slot] = offscreen
      const texture = new THREE.CanvasTexture(offscreen)
      if (slot === 'diffuse') texture.colorSpace = THREE.SRGBColorSpace
      textures[slot] = texture
    })
  )
}

/**
 * Builds the reflection probe the envMap slot samples.
 *
 * The source image is only ever a probe here, never the backdrop: three.js
 * projects an equirectangular background through the camera, and under an
 * orthographic one that lands as a misplaced patch rather than a surrounding
 * scene. A flat colour sits behind the rig instead, which is also the more
 * honest backdrop for judging a texture against.
 */
const createEnvironmentMap = async (renderer: THREE.WebGLRenderer): Promise<void> => {
  const probe = await textureLoader.loadAsync(lakeUrl)
  probe.mapping = THREE.EquirectangularReflectionMapping
  probe.colorSpace = THREE.SRGBColorSpace
  probeTexture = probe

  const pmrem = new THREE.PMREMGenerator(renderer)
  pmrem.compileEquirectangularShader()
  envMap = pmrem.fromEquirectangular(probe).texture
  pmrem.dispose()
}

const applyStrengths = (material: THREE.Material): void => {
  const standard = material as THREE.MeshStandardMaterial
  if (standard.normalMap && standard.normalScale)
    standard.normalScale.set(AVATAR_MAP_STRENGTHS.normalScale, AVATAR_MAP_STRENGTHS.normalScale)
  if (standard.aoMap) standard.aoMapIntensity = AVATAR_MAP_STRENGTHS.aoIntensity
  if ('displacementMap' in standard && standard.displacementMap)
    (standard as unknown as { displacementScale: number }).displacementScale =
      AVATAR_MAP_STRENGTHS.displacementScale
  if (standard.emissiveMap) standard.emissiveIntensity = AVATAR_MAP_STRENGTHS.emissiveIntensity
  if (standard.envMap) standard.envMapIntensity = AVATAR_MAP_STRENGTHS.envMapIntensity
}

const buildAvatarMaterial = (): THREE.Material => {
  const material = buildMaterial(
    AVATAR_MATERIAL_TYPE,
    MATERIAL_FEATURES[AVATAR_MATERIAL_TYPE],
    getEnabledMaps(DEFAULT_CONFIG),
    DEFAULT_CONFIG,
    { textures: textures as Record<string, THREE.Texture>, envMap }
  )
  // The rig's own meshes are drawn from both sides once a limb is scaled
  // past its neighbours, and the template's transparent margin has to cut
  // out rather than blend, or the rig reads as a solid slab.
  material.side = THREE.DoubleSide
  material.transparent = true
  material.alphaTest = AVATAR_ALPHA_TEST
  applyStrengths(material)
  return material
}

/** Pushes one freshly built material onto every mesh in the rig, disposing what it replaces. */
const rebuildMaterial = (): void => {
  if (!avatar) return
  const material = buildAvatarMaterial()
  avatar.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh) return
    const previous = mesh.material as THREE.Material
    mesh.material = material
    if (previous !== material) previous.dispose()
  })
}

const pushHistory = (slot: TextureSlotKey, dataUrl: string): void => {
  const history = paintHistory[slot]
  history.stack = history.stack.slice(0, history.index + 1)
  history.stack.push(dataUrl)
  if (history.stack.length > AVATAR_HISTORY_LIMIT) history.stack.shift()
  else history.index++
}

const applySnapshot = (slot: TextureSlotKey, dataUrl: string): void => {
  applyDataUrlToCanvas(offscreenCanvases[slot], dataUrl).then(() => {
    textures[slot].needsUpdate = true
    storageSaveLocal(storageKey(slot), dataUrl)
    updatePreviews()
  })
}

const undoPaint = (): void => {
  const slot = activeSlot.value
  const history = paintHistory[slot]
  if (history.index <= 0) return
  history.index--
  applySnapshot(slot, history.stack[history.index])
}

const redoPaint = (): void => {
  const slot = activeSlot.value
  const history = paintHistory[slot]
  if (history.index >= history.stack.length - 1) return
  history.index++
  applySnapshot(slot, history.stack[history.index])
}

const paintStroke = (fromUv: THREE.Vector2 | null, toUv: THREE.Vector2): void => {
  const slot = activeSlot.value
  const offscreen = offscreenCanvases[slot]
  if (!offscreen) return
  const context = offscreen.getContext('2d')!
  const size = offscreen.width
  const toX = toUv.x * size
  const toY = (1 - toUv.y) * size

  if (activeTool.value === 'fill') {
    floodFill(context, toX, toY, cssColorToRgba(brushColor.value))
  } else {
    const isEraser = activeTool.value === 'eraser'
    context.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over'
    const color = isEraser ? 'rgba(0,0,0,1)' : brushColor.value
    context.fillStyle = color
    context.strokeStyle = color
    context.lineWidth = brushSize.value
    context.lineCap = 'round'
    context.lineJoin = 'round'
    if (fromUv) {
      context.beginPath()
      context.moveTo(fromUv.x * size, (1 - fromUv.y) * size)
      context.lineTo(toX, toY)
      context.stroke()
    }
    context.beginPath()
    context.arc(toX, toY, brushSize.value / 2, 0, Math.PI * 2)
    context.fill()
    context.globalCompositeOperation = 'source-over'
  }

  textures[slot].needsUpdate = true
  didPaint = true
}

const resetSlot = async (slot: TextureSlotKey): Promise<void> => {
  const offscreen = offscreenCanvases[slot]
  if (!offscreen) return
  await fillSlotCanvas(slot, offscreen)
  textures[slot].needsUpdate = true
  const dataUrl = offscreen.toDataURL()
  storageSaveLocal(storageKey(slot), dataUrl)
  pushHistory(slot, dataUrl)
  updatePreviews()
}

const resetTexture = (): Promise<void> => resetSlot(activeSlot.value)

const resetAll = async (): Promise<void> => {
  await Promise.all(TEXTURE_SLOTS.map(resetSlot))
}

const handleTextureLoad = (event: Event): void => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const slot = activeSlot.value
  const offscreen = offscreenCanvases[slot]
  if (!offscreen) return
  const objectUrl = URL.createObjectURL(file)
  applyDataUrlToCanvas(offscreen, objectUrl).then(() => {
    URL.revokeObjectURL(objectUrl)
    textures[slot].needsUpdate = true
    const dataUrl = offscreen.toDataURL()
    storageSaveLocal(storageKey(slot), dataUrl)
    pushHistory(slot, dataUrl)
    updatePreviews()
  })
  input.value = ''
}

const getIntersection = (event: MouseEvent): THREE.Intersection | null => {
  if (!orthoCamera || !avatar || !canvasElement) return null
  const rect = canvasElement.getBoundingClientRect()
  const ndc = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1
  )
  const raycaster = new THREE.Raycaster()
  raycaster.setFromCamera(ndc, orthoCamera)
  return raycaster.intersectObject(avatar, true)[0] ?? null
}

/**
 * The projection parks every face that points sideways, up or down on the
 * single texel at the UV origin, so a click on a limb's edge would otherwise
 * dump paint in the canvas corner rather than where it was aimed.
 */
const isProjectedUv = (uv: THREE.Vector2): boolean => uv.x !== 0 || uv.y !== 0

const handleMouseDown = (event: MouseEvent): void => {
  if (!canvasElement) return
  const hit = getIntersection(event)

  if (activeTool.value !== 'rotate' && hit?.uv && isProjectedUv(hit.uv)) {
    activeMode = 'paint'
    didPaint = false
    paintStroke(null, hit.uv)
    lastPaintUv = hit.uv.clone()
    canvasElement.style.cursor = 'crosshair'
    return
  }

  activeMode = 'rotate'
  dragLastX = event.clientX
  dragLastY = event.clientY
  canvasElement.style.cursor = 'grabbing'
}

const handleMouseUp = (): void => {
  if (activeMode === 'paint' && didPaint) {
    const slot = activeSlot.value
    const dataUrl = offscreenCanvases[slot].toDataURL()
    pushHistory(slot, dataUrl)
    storageSaveLocal(storageKey(slot), dataUrl)
    updatePreviews()
  }
  activeMode = 'none'
  lastPaintUv = null
  didPaint = false
  if (canvasElement) canvasElement.style.cursor = 'default'
}

const handleMouseMove = (event: MouseEvent): void => {
  if (!avatar || !canvasElement) return

  if (activeMode === 'paint') {
    const hit = getIntersection(event)
    if (hit?.uv && isProjectedUv(hit.uv)) {
      paintStroke(lastPaintUv, hit.uv)
      lastPaintUv = hit.uv.clone()
    }
    return
  }

  if (activeMode === 'rotate') {
    avatar.rotation.y += (event.clientX - dragLastX) * AVATAR_DRAG_SENSITIVITY
    dragLastX = event.clientX
    dragLastY = event.clientY
    return
  }

  const hit = getIntersection(event)
  const isPaint = activeTool.value !== 'rotate'
  canvasElement.style.cursor = hit ? (isPaint ? 'crosshair' : 'grab') : 'default'
}

const applyFrustum = (): void => {
  if (!orthoCamera || !canvasElement) return
  const aspect = canvasElement.clientWidth / canvasElement.clientHeight
  orthoCamera.left = -frameHalfHeight * aspect
  orthoCamera.right = frameHalfHeight * aspect
  orthoCamera.top = frameHalfHeight
  orthoCamera.bottom = -frameHalfHeight
  orthoCamera.updateProjectionMatrix()
}

const handleResize = (): void => {
  if (!rendererReference || !canvasElement) return
  rendererReference.setSize(canvasElement.clientWidth, canvasElement.clientHeight)
  applyFrustum()
}

/**
 * Centres the rig at the origin and sizes the frustum to its own bounding
 * box, so the framing follows whatever the model actually measures rather
 * than a constant that only held for one rig at one scale.
 */
const frameAvatar = (model: THREE.Object3D): void => {
  const bounds = new THREE.Box3().setFromObject(model)
  const centre = bounds.getCenter(new THREE.Vector3())
  const size = bounds.getSize(new THREE.Vector3())
  model.position.sub(centre)
  frameHalfHeight = (size.y / 2) * (1 + AVATAR_FRAME_PADDING)
  applyFrustum()
}

/**
 * Wires the rig's own clips onto a mixer the shared animation helper can drive.
 *
 * Built here rather than through `getAnimationsModel`, which turns the model a
 * half-turn on its way past — right for a character running away down a track,
 * wrong for one being painted from the front.
 */
const attachWalkCycle = (model: THREE.Object3D, clips: THREE.AnimationClip[]): void => {
  const mixer = new THREE.AnimationMixer(model)
  model.userData.mixer = mixer
  model.userData.actions = Object.fromEntries(
    clips.map((clip) => [clip.name, mixer.clipAction(clip)])
  )
}

const advanceWalkCycle = (): void => {
  // Read every frame, walking or not, so resuming after a pause arrives as one
  // ordinary frame rather than as the whole pause in a single step.
  const delta = animationClock.getDelta()
  if (!isWalking.value || !avatar) return
  updateAnimation({
    actionName: AVATAR_WALK_ACTION,
    player: avatar as ComplexModel,
    delta,
    speed: AVATAR_WALK_SPEED
  })
  // The clip animates limb rotation, while the panel's nudges are position and
  // scale on the very same nodes — reasserted here rather than trusted to
  // survive whatever the mixer wrote this frame.
  if (partRig) applyStickmanPartOffsets(partRig, props.config.parts)
}

/** Stopping freezes the rig mid-stride, which is a pose worth painting against. */
const toggleWalk = (): void => {
  isWalking.value = !isWalking.value
}

const init = async (canvasReference: HTMLCanvasElement): Promise<void> => {
  canvasElement = canvasReference
  await initTextures()
  TEXTURE_SLOTS.forEach((slot) => {
    paintHistory[slot].stack = [offscreenCanvases[slot].toDataURL()]
    paintHistory[slot].index = 0
  })
  updatePreviews()

  const { setup, renderer, scene } = await getTools({ canvas: canvasReference, resize: false })
  rendererReference = renderer
  await createEnvironmentMap(renderer)

  orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, AVATAR_ORTHO_NEAR, AVATAR_ORTHO_FAR)
  orthoCamera.position.set(0, 0, AVATAR_ORTHO_DISTANCE)
  orthoCamera.lookAt(0, 0, 0)

  canvasReference.addEventListener('mousedown', handleMouseDown)
  canvasReference.addEventListener('mouseup', handleMouseUp)
  canvasReference.addEventListener('mousemove', handleMouseMove)

  await setup({
    config: {
      orbit: false,
      ground: false,
      lights: {
        ambient: { intensity: AMBIENT_LIGHT_INTENSITY },
        directional: {
          intensity: LIGHT_INTENSITY,
          position: [LIGHT_ORBIT_RADIUS, LIGHT_ORBIT_RADIUS, LIGHT_Z_POSITION] as [
            number,
            number,
            number
          ]
        },
        hemisphere: { colors: [HEMISPHERE_SKY, HEMISPHERE_GROUND] }
      }
    },
    defineSetup: async () => {
      // Loaded without physics: nothing here simulates, the rig only ever
      // stands still, walks on the spot, and turns under the pointer.
      const { model, gltf } = await loadGLTF(AVATAR_MODEL_PATH, { castShadow: true })
      avatar = model
      partRig = prepareStickmanRig(model, props.config.parts)
      attachWalkCycle(model, gltf.animations)
      model.visible = props.config.visible
      scene.add(model)
      frameAvatar(model)
      rebuildMaterial()

      const renderLoop = (): void => {
        requestAnimationFrame(renderLoop)
        advanceWalkCycle()
        if (orthoCamera) renderer.render(scene, orthoCamera)
      }
      renderLoop()
    }
  })

  scene.background = new THREE.Color(SCENE_BG_COLOR)
}

watch(
  () => props.config.parts,
  (parts) => {
    if (partRig) applyStickmanPartOffsets(partRig, parts)
  },
  { deep: true }
)

watch(
  () => props.config.visible,
  (visible) => {
    if (avatar) avatar.visible = visible
  }
)

defineExpose({ toggleWalk })

onMounted(async () => {
  if (canvas.value) await init(canvas.value)
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  if (canvasElement) {
    canvasElement.removeEventListener('mousedown', handleMouseDown)
    canvasElement.removeEventListener('mouseup', handleMouseUp)
    canvasElement.removeEventListener('mousemove', handleMouseMove)
  }
  Object.values(textures).forEach((texture) => texture.dispose())
  if (envMap) envMap.dispose()
  if (probeTexture) probeTexture.dispose()
  avatar = null
  partRig = null
  canvasElement = null
})
</script>

<template>
  <div class="avatar-editor">
    <canvas ref="canvas"></canvas>
    <div class="avatar-editor__strip">
      <img
        v-for="slot in TEXTURE_SLOTS"
        :key="slot"
        :src="previewUrls[slot]"
        class="avatar-editor__preview"
        :class="{ 'avatar-editor__preview--active': activeSlot === slot }"
        :title="TEXTURE_SLOT_LABELS[slot]"
        :alt="TEXTURE_SLOT_LABELS[slot]"
        @click="activeSlot = slot"
      />
    </div>
  </div>

  <Teleport defer to="#config-panel-extra">
    <div class="avatar-editor-toolbar">
      <p class="avatar-editor-toolbar__label">Texture</p>
      <div class="avatar-editor-toolbar__slots">
        <button
          v-for="slot in TEXTURE_SLOTS"
          :key="slot"
          class="avatar-editor-toolbar__slot-btn"
          :class="{ 'avatar-editor-toolbar__slot-btn--active': activeSlot === slot }"
          @click="activeSlot = slot"
        >
          {{ TEXTURE_SLOT_LABELS[slot] }}
        </button>
      </div>

      <div class="avatar-editor-toolbar__palette">
        <button
          v-for="color in TEXTURE_SLOT_PALETTE[activeSlot]"
          :key="color"
          class="avatar-editor-toolbar__swatch"
          :class="{ 'avatar-editor-toolbar__swatch--active': brushColor === color }"
          :style="{ background: color }"
          :title="color"
          @click="brushColor = color"
        />
      </div>

      <DrawingToolbar
        :tool="activeTool"
        :color="brushColor"
        :size="brushSize"
        :can-undo="canUndo"
        :can-redo="canRedo"
        :visible-tools="['brush', 'eraser', 'fill', 'rotate', 'color', 'size', 'undo', 'redo']"
        @update:tool="activeTool = $event"
        @update:color="brushColor = $event"
        @update:size="brushSize = $event"
        @undo="undoPaint"
        @redo="redoPaint"
      />

      <div class="avatar-editor-toolbar__resets">
        <button class="avatar-editor-toolbar__reset-btn" @click="resetTexture">
          Reset texture
        </button>
        <button class="avatar-editor-toolbar__reset-btn" @click="resetAll">Reset all</button>
      </div>

      <label class="avatar-editor-toolbar__load-label">
        Load image
        <input
          type="file"
          accept="image/*"
          class="avatar-editor-toolbar__load-input"
          @change="handleTextureLoad"
        />
      </label>
    </div>
  </Teleport>
</template>

<style scoped>
.avatar-editor {
  position: relative;
  width: 100%;
  height: 100vh;
}

canvas {
  display: block;
  width: 100%;
  height: 100vh;
}

.avatar-editor__strip {
  position: absolute;
  bottom: var(--spacing-4);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: var(--spacing-2);
  padding: var(--spacing-2);
  background: rgb(0 0 0 / 55%);
  border-radius: var(--radius-md);
  backdrop-filter: blur(4px);
}

.avatar-editor__preview {
  position: relative;
  width: 4rem;
  height: 4rem;
  border-radius: var(--radius-sm);
  border: 2px solid transparent;
  cursor: pointer;
  flex-shrink: 0;
  transition: border-color 150ms;
  image-rendering: pixelated;
}

.avatar-editor__preview:hover {
  border-color: var(--color-muted-foreground);
}

.avatar-editor__preview--active {
  border-color: var(--color-primary);
}

.avatar-editor-toolbar {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  padding-top: var(--spacing-3);
  border-top: 1px solid var(--color-border);
}

.avatar-editor-toolbar__label {
  font-size: var(--font-size-xs);
  font-weight: 500;
  color: var(--color-foreground);
  margin: 0;
}

.avatar-editor-toolbar__slots {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-1);
}

.avatar-editor-toolbar__slot-btn {
  padding: var(--spacing-1) var(--spacing-2);
  font-size: var(--font-size-xs);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-secondary);
  color: var(--color-muted-foreground);
  cursor: pointer;
}

.avatar-editor-toolbar__slot-btn:hover {
  color: var(--color-foreground);
  background: var(--color-muted);
}

.avatar-editor-toolbar__slot-btn--active {
  color: var(--color-foreground);
  background: var(--color-muted);
  border-color: var(--color-primary);
}

.avatar-editor-toolbar__palette {
  display: flex;
  gap: var(--spacing-1);
  flex-wrap: wrap;
}

.avatar-editor-toolbar__swatch {
  width: 1.5rem;
  height: 1.5rem;
  border-radius: var(--radius-sm);
  border: 2px solid transparent;
  cursor: pointer;
  padding: 0;
}

.avatar-editor-toolbar__swatch--active {
  border-color: var(--color-foreground);
}

.avatar-editor-toolbar__swatch:hover {
  opacity: 0.85;
}

.avatar-editor-toolbar__resets {
  display: flex;
  gap: var(--spacing-1);
}

.avatar-editor-toolbar__reset-btn {
  flex: 1;
  padding: var(--spacing-1) var(--spacing-2);
  font-size: var(--font-size-xs);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-secondary);
  color: var(--color-muted-foreground);
  cursor: pointer;
}

.avatar-editor-toolbar__reset-btn:hover {
  color: var(--color-foreground);
  background: var(--color-muted);
}

.avatar-editor-toolbar__load-label {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
  font-size: var(--font-size-xs);
  font-weight: 500;
  color: var(--color-foreground);
  cursor: pointer;
}

.avatar-editor-toolbar__load-input {
  font-size: var(--font-size-xs);
  color: var(--color-muted-foreground);
  cursor: pointer;
}

.avatar-editor-toolbar__load-input::file-selector-button {
  font-size: var(--font-size-xs);
  padding: var(--spacing-1) var(--spacing-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-secondary);
  color: var(--color-muted-foreground);
  cursor: pointer;
}
</style>
