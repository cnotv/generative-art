<script setup lang="ts">
import * as THREE from 'three'
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { getTools, loadGLTF } from '@webgamekit/threejs'
import { updateAnimation } from '@webgamekit/animation'
import type { ComplexModel } from '@webgamekit/animation'
import { storageSaveLocal, storageLoadLocal } from '@webgamekit/canvas-editor'
import drawTemplateUrl from '@/assets/images/characters/stickman_draw_template.png'
import { floodFill, cssColorToRgba } from '@/utils/canvasFloodFill'
import { downloadDataUrl } from '@/utils/downloadDataUrl'
import {
  applyStickmanPartOffsets,
  prepareStickmanRig,
  createStickmanPartOffsets,
  STICKMAN_PART_NAMES
} from '@/utils/stickmanRig'
import type { StickmanPartName, StickmanPartRig } from '@/types/stickmanRig'
import { DrawingToolbar } from '@/components/DrawingToolbar'
import type { DrawingTool } from '@/components/DrawingToolbar'
import {
  LobbyUIRow,
  LobbyUIConfigField,
  LobbyUIOptionToggle,
  LobbyUIColorSwatches,
  LobbyUIButton
} from '@/components/LobbyUI'
import type { LobbyConfigField } from '@/types/lobbyWizard'
import '@/assets/styles/lobby-ui.scss'
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
  AVATAR_BACKGROUND_COLOR,
  AVATAR_PANEL_DIVIDER_COLOR,
  STORAGE_KEY,
  TEXTURE_BASE_COLOR,
  TEXTURE_PALETTE,
  TEXTURE_DEFAULT_COLOR
} from './config'

const canvas = ref<HTMLCanvasElement | null>(null)
const loadInput = ref<HTMLInputElement | null>(null)

const GUIDE_OPTIONS = [
  { value: 'on', label: 'On' },
  { value: 'off', label: 'Off' }
]

/**
 * Every control lives in the editor's own panel rather than the app's config
 * panel: they are all about the figure being drawn, and splitting them across
 * two surfaces meant reaching past the model to change how the model looks.
 * The config panel keeps the global scene settings, which belong to no view.
 */
const opacity = ref(1)
const showGuide = ref(true)
const parts = ref(createStickmanPartOffsets())
const activePart = ref<StickmanPartName>('head')

const PART_LABELS: Record<StickmanPartName, string> = {
  head: 'Head',
  torso: 'Torso',
  armLeft: 'Arm L',
  armRight: 'Arm R',
  legs: 'Legs'
}

const partOptions = STICKMAN_PART_NAMES.map((name) => ({ value: name, label: PART_LABELS[name] }))

const opacityField = computed<LobbyConfigField>(() => ({
  type: 'number',
  key: 'opacity',
  label: 'Opacity',
  value: opacity.value,
  min: 0,
  max: 1,
  step: 0.05
}))

// One limb at a time, picked by the toggle above them: five limbs times four
// figures is twenty fields, which buries everything else in the panel.
const partFields = computed<LobbyConfigField[]>(() => {
  const offset = parts.value[activePart.value]
  const axis = (key: 'x' | 'y' | 'z'): LobbyConfigField => ({
    type: 'number',
    key,
    label: key.toUpperCase(),
    value: offset.position[key],
    min: -1,
    max: 1,
    step: 0.01
  })
  return [
    axis('x'),
    axis('y'),
    axis('z'),
    {
      type: 'number',
      key: 'scale',
      label: 'Size',
      value: offset.scale,
      min: 0.2,
      max: 3,
      step: 0.05
    }
  ]
})

const updatePartField = (key: string, value: string | number): void => {
  const offset = parts.value[activePart.value]
  const next = Number(value)
  parts.value = {
    ...parts.value,
    [activePart.value]:
      key === 'scale'
        ? { ...offset, scale: next }
        : { ...offset, position: { ...offset.position, [key]: next } }
  }
}

let avatar: THREE.Object3D | null = null
let partRig: StickmanPartRig | null = null
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
/**
 * Lays one square body image into each panel.
 *
 * A texture for this rig is authored as a single square sheet — that is the
 * shape the game's own skins and the drawing template come in. The editor's
 * sheet is two of those side by side, so an image belongs in each half at panel
 * size rather than stretched across the pair, which would double its width and
 * leave nothing lining up with the body.
 */
const drawIntoPanels = (context: CanvasRenderingContext2D, image: CanvasImageSource): void => {
  Array.from({ length: AVATAR_PANEL_COUNT }, (_, panel) =>
    context.drawImage(image, panel * AVATAR_PANEL_SIZE, 0, AVATAR_PANEL_SIZE, AVATAR_PANEL_SIZE)
  )
}

const drawGuidePanels = (context: CanvasRenderingContext2D): void => {
  if (!guideImage) return
  drawIntoPanels(context, guideImage)
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
  context.globalAlpha = opacity.value
  context.fillStyle = TEXTURE_BASE_COLOR
  context.fillRect(0, 0, displayCanvas.width, displayCanvas.height)
  if (showGuide.value) drawGuidePanels(context)
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
 * Unlit on purpose. Every shaded material — Standard, Phong, Lambert — mixes
 * light into the surface, so the same drawing comes out darker on a limb facing
 * away and brighter on one facing the lamp, and the colour picked in the
 * palette is never the colour on the model. Basic samples the map and nothing
 * else, so the figure shows exactly what was drawn.
 */
const buildAvatarMaterial = (): THREE.Material =>
  new THREE.MeshBasicMaterial({
    map: colorTexture,
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
 * Puts the whole editor back to how it opens: the drawing, the limbs, and the
 * panel's own settings. The undo stack goes with it, so a discard cannot be
 * walked back one stroke at a time.
 */
const resetAll = (): void => {
  paintHistory.value = { stack: [], index: -1 }
  clearPaint()
  parts.value = createStickmanPartOffsets()
  opacity.value = 1
  showGuide.value = true
}

/** Saves the sheet as a usable texture: base plus paint, with no guide over it. */
const saveTexturePng = (): void => {
  if (!paintCanvas) return
  downloadDataUrl(composeExportCanvas().toDataURL('image/png'), `${AVATAR_EXPORT_PREFIX}.png`)
}

/**
 * Loads a square body texture — a game skin, or a sheet saved out of here —
 * into both panels, so it lands on the rig the same way it does in the game.
 */
const handleTextureLoad = (event: Event): void => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  const target = paintCanvas
  if (!file || !target) return
  const objectUrl = URL.createObjectURL(file)
  const image = new Image()
  image.onload = () => {
    const context = target.getContext('2d')!
    context.globalCompositeOperation = 'source-over'
    context.clearRect(0, 0, target.width, target.height)
    drawIntoPanels(context, image)
    URL.revokeObjectURL(objectUrl)
    refreshDisplay()
    commitPaint()
  }
  image.src = objectUrl
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
  if (partRig) applyStickmanPartOffsets(partRig, parts.value)
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
  if (partRig) applyStickmanPartOffsets(partRig, parts.value)
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

  orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, AVATAR_ORTHO_NEAR, AVATAR_ORTHO_FAR)
  orthoCamera.position.set(0, 0, AVATAR_ORTHO_DISTANCE)
  orthoCamera.lookAt(0, 0, 0)

  canvasReference.addEventListener('mousedown', handleMouseDown)
  canvasReference.addEventListener('mouseup', handleMouseUp)
  canvasReference.addEventListener('mousemove', handleMouseMove)

  await setup({
    config: {
      orbit: false,
      ground: false
    },
    defineSetup: async () => {
      // Loaded without physics: nothing here simulates, the rig only ever
      // stands still, walks on the spot, and turns under the pointer.
      const { model, gltf } = await loadGLTF(AVATAR_MODEL_PATH, { castShadow: true })
      avatar = model
      // Split so the two faces get a half of the sheet each, rather than
      // sharing one image that makes a mark on the front show on the back.
      partRig = prepareStickmanRig(model, parts.value, 'split')
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

  scene.background = new THREE.Color(AVATAR_BACKGROUND_COLOR)
  // The renderer sizes itself to the window, which is not what the canvas
  // actually gets once the controls take their column beside it — left alone,
  // the rig renders centred on the window and so drifts under the panel.
  handleResize()
}

watch(
  parts,
  (current) => {
    if (partRig) applyStickmanPartOffsets(partRig, current)
  },
  { deep: true }
)

watch([opacity, showGuide], refreshDisplay)

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
  avatar = null
  partRig = null
  canvasElement = null
})
</script>

<template>
  <!-- The controls are LobbyUI, which fixes its text white for a scene backdrop
       rather than following the host theme, so the whole surface carries the
       scene's own colour instead of only the part the canvas covers. -->
  <div class="avatar-editor" :style="{ background: AVATAR_BACKGROUND_COLOR }">
    <canvas ref="canvas"></canvas>

    <aside class="avatar-editor__panel">
      <section class="avatar-editor__section">
        <LobbyUIRow label="Opacity">
          <LobbyUIConfigField
            :field="opacityField"
            size="sm"
            @change="(_key, value) => (opacity = Number(value))"
          />
        </LobbyUIRow>
        <LobbyUIRow label="Guide">
          <LobbyUIOptionToggle
            :model-value="showGuide ? 'on' : 'off'"
            :options="GUIDE_OPTIONS"
            size="sm"
            @update:model-value="showGuide = $event === 'on'"
          />
        </LobbyUIRow>
        <LobbyUIRow label="Walk">
          <LobbyUIButton variant="ghost" size="sm" @click="toggleWalk">
            {{ isWalking ? 'Stop' : 'Play' }}
          </LobbyUIButton>
        </LobbyUIRow>
      </section>

      <section class="avatar-editor__section">
        <h2 class="avatar-editor__heading">Parts</h2>
        <LobbyUIOptionToggle v-model="activePart" :options="partOptions" size="sm" />
        <LobbyUIRow v-for="field in partFields" :key="field.key" :label="field.label">
          <LobbyUIConfigField :field="field" size="sm" @change="updatePartField" />
        </LobbyUIRow>
      </section>

      <section class="avatar-editor__section">
        <h2 class="avatar-editor__heading">Drawing</h2>
        <LobbyUIColorSwatches v-model="brushColor" :colors="TEXTURE_PALETTE" />
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
        <div class="avatar-editor__actions">
          <LobbyUIButton variant="ghost" size="sm" @click="clearPaint">Clear</LobbyUIButton>
          <LobbyUIButton variant="ghost" size="sm" @click="saveTexturePng">Save PNG</LobbyUIButton>
          <LobbyUIButton variant="ghost" size="sm" @click="loadInput?.click()">Load</LobbyUIButton>
          <LobbyUIButton variant="ghost" size="sm" @click="resetAll">Reset</LobbyUIButton>
        </div>
        <input
          ref="loadInput"
          type="file"
          accept="image/*"
          class="avatar-editor__file"
          @change="handleTextureLoad"
        />
      </section>
    </aside>
  </div>
</template>

<style scoped>
/* Controls and figure share the row rather than the controls floating over it:
   laid out side by side they cannot overlap at any width, and the camera
   centres the rig inside whatever space is left, so the pair reads as centred
   with a gap down the middle. */
.avatar-editor {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-8);
  width: 100%;
  height: 100vh;
}

/* App.vue positions every canvas absolutely so a scene can fill the viewport.
   Here it has to share the row with the controls, and an absolute canvas is out
   of flex flow entirely — the panel would sit on top of it however wide the
   column is. */

/* Held to a width rather than given the rest of the row: the camera frames the
   rig against the canvas height, so extra width only pads it out with empty
   space and pushes the controls away from the figure they describe. Bounded
   here, the pair sits centred with a gap between the two. */
canvas {
  display: block;
  position: relative;
  inset: auto;
  flex: 0 1 34rem;
  min-width: 0;
  height: 100vh;
}

.avatar-editor__panel {
  /* Controls read before the figure they describe; the canvas stays first in
     the markup so the scene is what a reader meets first. */
  order: -1;
  flex: 0 0 17rem;
  max-height: 100vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
  padding: var(--spacing-4);

  --lui-label-column: 3.5rem;
}

.avatar-editor__section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.avatar-editor__heading {
  margin: 0;
  font-family: var(--lui-font);
  font-weight: 900;
  font-size: var(--lui-text-small);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
}

.avatar-editor__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-1);
}

.avatar-editor__file {
  display: none;
}

/* No room for two columns on a narrow screen, so they stack instead. */
@media (width <= 768px) {
  .avatar-editor {
    flex-direction: column;
    height: auto;
    gap: var(--spacing-2);
  }

  canvas {
    width: 100%;
    height: 60vh;
  }

  .avatar-editor__panel {
    flex: 0 0 auto;
    width: 100%;
  }
}
</style>
