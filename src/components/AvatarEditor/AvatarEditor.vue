<script setup lang="ts">
import * as THREE from 'three'
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { getTools, loadGLTF, textureLoader } from '@webgamekit/threejs'
import { updateAnimation } from '@webgamekit/animation'
import type { ComplexModel } from '@webgamekit/animation'
import { storageSaveLocal, storageLoadLocal } from '@webgamekit/canvas-editor'
import lakeUrl from '@/assets/images/backgrounds/lake.webp'
import drawTemplateUrl from '@/assets/images/characters/stickman_draw_template.png'
import { floodFill, cssColorToRgba } from '@/utils/canvasFloodFill'
import { downloadDataUrl } from '@/utils/downloadDataUrl'
import { applyStickmanPartOffsets, prepareStickmanRig } from '@/utils/stickmanRig'
import type { StickmanPartRig } from '@/types/stickmanRig'
import type { AvatarEditorConfig } from '@/types/avatarEditor'
import { DrawingToolbar } from '@/components/DrawingToolbar'
import type { DrawingTool } from '@/components/DrawingToolbar'
import {
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
  AVATAR_CANVAS_WIDTH,
  AVATAR_CANVAS_HEIGHT,
  AVATAR_PANEL_SIZE,
  AVATAR_PANEL_COUNT,
  AVATAR_FRAME_PADDING,
  AVATAR_ORTHO_NEAR,
  AVATAR_ORTHO_FAR,
  AVATAR_ORTHO_DISTANCE,
  AVATAR_DRAG_SENSITIVITY,
  AVATAR_BRUSH_SIZE_DEFAULT,
  AVATAR_HISTORY_LIMIT,
  AVATAR_WALK_ACTION,
  AVATAR_WALK_SPEED,
  AVATAR_EXPORT_PREFIX,
  AVATAR_ALPHA_CUTOFF,
  AVATAR_ROUGHNESS,
  AVATAR_METALNESS,
  AVATAR_ENV_MAP_INTENSITY,
  AVATAR_PANEL_DIVIDER_COLOR,
  STORAGE_KEY,
  TEXTURE_BASE_COLOR,
  TEXTURE_PALETTE,
  TEXTURE_DEFAULT_COLOR
} from './config'

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
let restPose: {
  node: THREE.Object3D
  quaternion: THREE.Quaternion
  position: THREE.Vector3
  scale: THREE.Vector3
}[] = []

/** What the brush writes to, and the only thing ever saved or exported. */
let paintCanvas: HTMLCanvasElement | null = null
/** What the material samples: the base, the guide, and the paint stacked up. */
let displayCanvas: HTMLCanvasElement | null = null
let colorTexture: THREE.CanvasTexture | null = null
let guideImage: HTMLImageElement | null = null

const activeTool = ref<DrawingTool>('brush')
const brushColor = ref(TEXTURE_DEFAULT_COLOR)
const brushSize = ref(AVATAR_BRUSH_SIZE_DEFAULT)

type ActiveMode = 'paint' | 'rotate' | 'none'
let activeMode: ActiveMode = 'none'
let lastPaintUv: THREE.Vector2 | null = null
let didPaint = false
let dragLastX = 0

const paintHistory = ref<{ stack: string[]; index: number }>({ stack: [], index: -1 })
const canUndo = computed(() => paintHistory.value.index > 0)
const canRedo = computed(() => paintHistory.value.index < paintHistory.value.stack.length - 1)

const applyDataUrlToCanvas = (target: HTMLCanvasElement, dataUrl: string): Promise<void> =>
  new Promise((resolve) => {
    const image = new Image()
    image.onload = () => {
      const context = target.getContext('2d')!
      context.clearRect(0, 0, target.width, target.height)
      context.drawImage(image, 0, 0, target.width, target.height)
      resolve()
    }
    image.onerror = () => resolve()
    image.src = dataUrl
  })

const createBlankCanvas = (): HTMLCanvasElement => {
  const blank = document.createElement('canvas')
  blank.width = AVATAR_CANVAS_WIDTH
  blank.height = AVATAR_CANVAS_HEIGHT
  return blank
}

/**
 * Draws the body template once into each panel, with a divider between them.
 *
 * The silhouette is the same from either side, so the one template serves both
 * halves; the line is there because the halves are otherwise indistinguishable
 * on a flat sheet, and painting across the seam by accident is easy.
 */
const drawGuidePanels = (context: CanvasRenderingContext2D): void => {
  if (!guideImage) return
  const template = guideImage
  Array.from({ length: AVATAR_PANEL_COUNT }, (_, panel) =>
    context.drawImage(template, panel * AVATAR_PANEL_SIZE, 0, AVATAR_PANEL_SIZE, AVATAR_PANEL_SIZE)
  )
  context.strokeStyle = AVATAR_PANEL_DIVIDER_COLOR
  context.lineWidth = 2
  context.beginPath()
  context.moveTo(AVATAR_PANEL_SIZE, 0)
  context.lineTo(AVATAR_PANEL_SIZE, AVATAR_CANVAS_HEIGHT)
  context.stroke()
}

/**
 * Stacks the canvas the material samples: the flat base, the body template
 * while the guide is on, then the paint layer over both.
 *
 * Order is the whole point. The guide has to sit under the paint or it covers
 * the very strokes it exists to help place, and over the base or an opaque map
 * would bury it. That only works because the paint layer is genuinely
 * transparent where nothing has been drawn, which is also what lets the eraser
 * expose the guide again rather than punch through to nothing.
 *
 * Opacity fades the body, never the drawing on it: the base and the guide are
 * the model's own appearance, the paint layer is the work. Taken to zero, the
 * map is transparent everywhere nothing was drawn and the material's alpha cuts
 * the mesh away, leaving the drawing hanging in space.
 */
const refreshDisplay = (): void => {
  if (!displayCanvas || !paintCanvas || !colorTexture) return
  const context = displayCanvas.getContext('2d')!
  context.globalCompositeOperation = 'source-over'
  context.clearRect(0, 0, displayCanvas.width, displayCanvas.height)
  context.globalAlpha = props.config.opacity
  context.fillStyle = TEXTURE_BASE_COLOR
  context.fillRect(0, 0, displayCanvas.width, displayCanvas.height)
  if (props.config.showGuide) drawGuidePanels(context)
  context.globalAlpha = 1
  context.drawImage(paintCanvas, 0, 0)
  colorTexture.needsUpdate = true
}

/** The sheet as a finished texture: the base with the paint on top, never the guide. */
const composeExportCanvas = (): HTMLCanvasElement => {
  const exported = createBlankCanvas()
  const context = exported.getContext('2d')!
  context.fillStyle = TEXTURE_BASE_COLOR
  context.fillRect(0, 0, exported.width, exported.height)
  if (paintCanvas) context.drawImage(paintCanvas, 0, 0)
  return exported
}

const loadGuideImage = (): Promise<HTMLImageElement> =>
  new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.src = drawTemplateUrl
  })

const initTexture = async (): Promise<void> => {
  guideImage = await loadGuideImage()
  paintCanvas = createBlankCanvas()
  const saved = storageLoadLocal(STORAGE_KEY)
  if (saved?.dataUrl) await applyDataUrlToCanvas(paintCanvas, saved.dataUrl)
  displayCanvas = createBlankCanvas()
  colorTexture = new THREE.CanvasTexture(displayCanvas)
  colorTexture.colorSpace = THREE.SRGBColorSpace
  refreshDisplay()
}

/**
 * Builds the reflection probe the material samples.
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

const buildAvatarMaterial = (): THREE.Material =>
  new THREE.MeshStandardMaterial({
    map: colorTexture,
    envMap,
    envMapIntensity: AVATAR_ENV_MAP_INTENSITY,
    roughness: AVATAR_ROUGHNESS,
    metalness: AVATAR_METALNESS,
    // The rig's meshes are seen from both sides once a limb is scaled past its
    // neighbours, and the map carries real transparency wherever the body has
    // been faded out or rubbed away, so blending stays on.
    side: THREE.DoubleSide,
    transparent: true,
    // Fully transparent texels are discarded rather than blended, which also
    // stops them writing depth. Without that a body faded to nothing would go
    // on hiding the strokes behind it, invisible but still occluding. The
    // threshold sits only just above nothing, so every partial fade still
    // blends instead of snapping away the moment it dips under a half.
    alphaTest: AVATAR_ALPHA_CUTOFF,
    depthWrite: true
  })

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

const pushHistory = (dataUrl: string): void => {
  const history = paintHistory.value
  const stack = [...history.stack.slice(0, history.index + 1), dataUrl]
  const trimmed = stack.length > AVATAR_HISTORY_LIMIT ? stack.slice(1) : stack
  paintHistory.value = { stack: trimmed, index: trimmed.length - 1 }
}

const commitPaint = (): void => {
  if (!paintCanvas) return
  const dataUrl = paintCanvas.toDataURL()
  storageSaveLocal(STORAGE_KEY, dataUrl)
  pushHistory(dataUrl)
}

const applySnapshot = (dataUrl: string): void => {
  if (!paintCanvas) return
  applyDataUrlToCanvas(paintCanvas, dataUrl).then(() => {
    refreshDisplay()
    storageSaveLocal(STORAGE_KEY, dataUrl)
  })
}

const undoPaint = (): void => {
  if (!canUndo.value) return
  paintHistory.value = { ...paintHistory.value, index: paintHistory.value.index - 1 }
  applySnapshot(paintHistory.value.stack[paintHistory.value.index])
}

const redoPaint = (): void => {
  if (!canRedo.value) return
  paintHistory.value = { ...paintHistory.value, index: paintHistory.value.index + 1 }
  applySnapshot(paintHistory.value.stack[paintHistory.value.index])
}

const paintStroke = (fromUv: THREE.Vector2 | null, toUv: THREE.Vector2): void => {
  if (!paintCanvas) return
  const context = paintCanvas.getContext('2d')!
  // Scaled per axis rather than by one figure: the sheet is two panels wide and
  // one tall, so reusing the width for Y drops every stroke at twice the depth
  // it was aimed at.
  const toX = toUv.x * paintCanvas.width
  const toY = (1 - toUv.y) * paintCanvas.height

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
      context.moveTo(fromUv.x * paintCanvas.width, (1 - fromUv.y) * paintCanvas.height)
      context.lineTo(toX, toY)
      context.stroke()
    }
    context.beginPath()
    context.arc(toX, toY, brushSize.value / 2, 0, Math.PI * 2)
    context.fill()
    context.globalCompositeOperation = 'source-over'
  }

  refreshDisplay()
  didPaint = true
}

const clearPaint = (): void => {
  if (!paintCanvas) return
  const context = paintCanvas.getContext('2d')!
  context.globalCompositeOperation = 'source-over'
  context.clearRect(0, 0, paintCanvas.width, paintCanvas.height)
  refreshDisplay()
  commitPaint()
}

/**
 * Wipes the drawing and forgets the undo stack with it, so a discard cannot be
 * walked back one stroke at a time.
 */
const discardPaintedTexture = (): void => {
  paintHistory.value = { stack: [], index: -1 }
  clearPaint()
}

/** Saves the sheet as a usable texture: base plus paint, with no guide over it. */
const saveTexturePng = (): void => {
  if (!paintCanvas) return
  downloadDataUrl(composeExportCanvas().toDataURL('image/png'), `${AVATAR_EXPORT_PREFIX}.png`)
}

const handleTextureLoad = (event: Event): void => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !paintCanvas) return
  const objectUrl = URL.createObjectURL(file)
  applyDataUrlToCanvas(paintCanvas, objectUrl).then(() => {
    URL.revokeObjectURL(objectUrl)
    refreshDisplay()
    commitPaint()
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
 * dump paint in the sheet's corner rather than where it was aimed.
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
  canvasElement.style.cursor = 'grabbing'
}

const handleMouseUp = (): void => {
  if (activeMode === 'paint' && didPaint) commitPaint()
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
 * Centres the rig at the origin and sizes the frustum to its own bounding box,
 * so the framing follows whatever the model actually measures rather than a
 * constant that only held for one rig at one scale.
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

const collectNodes = (node: THREE.Object3D): THREE.Object3D[] => [
  node,
  ...node.children.flatMap(collectNodes)
]

/**
 * The rig's authored pose, read once before any clip has written over it.
 *
 * Descendants only. The root carries what the view owns rather than the model
 * — where the camera framed it, and however far the pointer has turned it — so
 * restoring that too would yank the rig back to front and centre every time the
 * walk stopped.
 */
const captureRestPose = (model: THREE.Object3D): void => {
  restPose = model.children.flatMap(collectNodes).map((node) => ({
    node,
    quaternion: node.quaternion.clone(),
    position: node.position.clone(),
    scale: node.scale.clone()
  }))
}

/**
 * Puts the rig back where the model file had it, then re-asserts the panel's
 * own limb nudges over the top.
 *
 * The capture is the whole rig, not just the limbs the panel names, because a
 * clip writes to whatever nodes it likes. Nudges are re-applied rather than
 * restored from the capture, or stopping the walk would also silently undo any
 * slider moved while it was running.
 */
const restoreRestPose = (): void => {
  restPose.forEach(({ node, quaternion, position, scale }) => {
    node.quaternion.copy(quaternion)
    node.position.copy(position)
    node.scale.copy(scale)
  })
  if (partRig) applyStickmanPartOffsets(partRig, props.config.parts)
}

/** Stopping returns the rig to its rest pose rather than leaving it mid-stride. */
const toggleWalk = (): void => {
  isWalking.value = !isWalking.value
  if (isWalking.value || !avatar) return
  const mixer = avatar.userData.mixer as THREE.AnimationMixer | undefined
  mixer?.stopAllAction()
  avatar.userData.currentAction = null
  restoreRestPose()
}

const init = async (canvasReference: HTMLCanvasElement): Promise<void> => {
  canvasElement = canvasReference
  await initTexture()
  if (paintCanvas) paintHistory.value = { stack: [paintCanvas.toDataURL()], index: 0 }

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
      // Split so the two faces get a half of the sheet each, rather than
      // sharing one image that makes a mark on the front show on the back.
      partRig = prepareStickmanRig(model, props.config.parts, 'split')
      captureRestPose(model)
      attachWalkCycle(model, gltf.animations)
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

watch([() => props.config.opacity, () => props.config.showGuide], refreshDisplay)

defineExpose({ toggleWalk, discardPaintedTexture })

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
  colorTexture?.dispose()
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
  </div>

  <Teleport defer to="#config-panel-extra">
    <div class="avatar-editor-toolbar">
      <p class="avatar-editor-toolbar__label">Texture</p>

      <div class="avatar-editor-toolbar__palette">
        <button
          v-for="color in TEXTURE_PALETTE"
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

      <button class="avatar-editor-toolbar__button" @click="clearPaint">Clear drawing</button>
      <button class="avatar-editor-toolbar__button" @click="saveTexturePng">
        Save texture as PNG
      </button>

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

.avatar-editor-toolbar__button {
  padding: var(--spacing-1) var(--spacing-2);
  font-size: var(--font-size-xs);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-secondary);
  color: var(--color-muted-foreground);
  cursor: pointer;
}

.avatar-editor-toolbar__button:hover {
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
