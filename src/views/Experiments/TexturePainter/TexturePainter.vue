<script setup lang="ts">
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { getTools } from '@webgamekit/threejs'
import { createTimelineManager, animateTimeline } from '@webgamekit/animation'
import { storageSaveLocal, storageLoadLocal } from '@webgamekit/canvas-editor'
import { registerViewConfig, unregisterViewConfig, createReactiveConfig } from '@/stores/viewConfig'
import lakeUrl from '@/assets/images/backgrounds/lake.webp'
import { useViewPanelsStore } from '@/stores/viewPanels'
import { usePanelsStore } from '@/stores/panels'
import { buildMaterial } from '@/utils/materialBuilder'
import { DrawingToolbar } from '@/components/DrawingToolbar'
import type { DrawingTool } from '@/components/DrawingToolbar'
import {
  MAIN_MATERIAL_TYPES,
  MATERIAL_LABELS,
  MATERIAL_FEATURES,
  DEFAULT_CONFIG,
  CONFIG_SCHEMA,
  getEnabledMaps,
  SPHERE_SEGMENT_COUNT,
  BRICK_WIDTH,
  BRICK_HEIGHT,
  MORTAR_SIZE,
  MORTAR_EDGE_OFFSET,
  MORTAR_EDGE_SIZE,
  LIGHT_INTENSITY,
  AMBIENT_LIGHT_INTENSITY,
  HEMISPHERE_SKY,
  HEMISPHERE_GROUND,
  LIGHT_ORBIT_RADIUS,
  LIGHT_Z_POSITION,
  PAINTER_SPHERE_RADIUS,
  PAINTER_LIGHT_ORBIT_SPEED,
  PAINTER_TARGET_FPS,
  PAINTER_ORTHO_FRUSTUM,
  PAINTER_ORTHO_NEAR,
  PAINTER_ORTHO_FAR,
  PAINTER_ORTHO_DISTANCE,
  PAINTER_CANVAS_SIZE,
  STORAGE_PREFIX,
  TEXTURE_SLOTS,
  TEXTURE_SLOT_LABELS,
  TEXTURE_SLOT_PALETTE,
  TEXTURE_SLOT_DEFAULT_COLOR
} from './config'
import type { MaterialTypeName, MaterialsListConfig, TextureSlotKey } from './config'

const canvas = ref<HTMLCanvasElement | null>(null)
const route = useRoute()
const { setViewPanels, clearViewPanels } = useViewPanelsStore()

let sphere: THREE.Mesh | null = null
let envMap: THREE.Texture | null = null
let backgroundTexture: THREE.Texture | null = null
let orbitControls: OrbitControls | null = null
let orthoCamera: THREE.OrthographicCamera | null = null
let rendererReference: THREE.WebGLRenderer | null = null
let canvasElement: HTMLCanvasElement | null = null

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

const activeTool = ref<DrawingTool>('rotate')
const brushColor = ref(TEXTURE_SLOT_DEFAULT_COLOR.diffuse)
const BRUSH_SIZE_DEFAULT = 20
const brushSize = ref(BRUSH_SIZE_DEFAULT)

const HISTORY_LIMIT = 20
const paintHistory = reactive<Record<TextureSlotKey, { stack: string[]; index: number }>>(
  Object.fromEntries(
    TEXTURE_SLOTS.map((s) => [s, { stack: [] as string[], index: -1 }])
  ) as unknown as Record<TextureSlotKey, { stack: string[]; index: number }>
)
const canUndo = computed(() => paintHistory[activeSlot.value].index > 0)
const canRedo = computed(() => {
  const h = paintHistory[activeSlot.value]
  return h.index < h.stack.length - 1
})

const textures: Record<string, THREE.CanvasTexture> = {}
const offscreenCanvases: Record<string, HTMLCanvasElement> = {}

const activeSlot = ref<TextureSlotKey>('diffuse')

watch(activeSlot, (slot) => {
  const palette = TEXTURE_SLOT_PALETTE[slot]
  if (!palette.includes(brushColor.value)) brushColor.value = palette[0]
})

const reactiveConfig = createReactiveConfig<{
  materialType: MaterialTypeName
  config: {
    normalScale: number
    aoIntensity: number
    displacementScale: number
    emissiveIntensity: number
    envMapIntensity: number
  }
  materials: MaterialsListConfig
}>({
  materialType: 'MeshPhysicalMaterial',
  config: {
    normalScale: 2,
    aoIntensity: 1,
    displacementScale: 0.25,
    emissiveIntensity: 1.5,
    envMapIntensity: 1
  },
  materials: { ...DEFAULT_CONFIG }
})

const configControls = {
  __defaultOpenGroups: [] as string[],
  materialType: {
    label: 'Material',
    component: 'ButtonSelector' as const,
    options: MAIN_MATERIAL_TYPES.map((t) => ({ value: t, label: MATERIAL_LABELS[t] }))
  },
  config: {
    normalScale: { min: 0, max: 5, step: 0.1, label: 'Normal Scale' },
    aoIntensity: { min: 0, max: 2, step: 0.05, label: 'AO Intensity' },
    displacementScale: { min: 0, max: 2, step: 0.01, label: 'Displacement Scale' },
    emissiveIntensity: { min: 0, max: 5, step: 0.1, label: 'Emissive Intensity' },
    envMapIntensity: { min: 0, max: 3, step: 0.1, label: 'Env Map Intensity' }
  },
  materials: {
    properties: CONFIG_SCHEMA.properties,
    maps: CONFIG_SCHEMA.maps
  }
}

const storageKey = (slot: TextureSlotKey): string => `${STORAGE_PREFIX}-${slot}`

const createOffscreenCanvas = (
  drawFunction: (ctx: CanvasRenderingContext2D, size: number) => void
): HTMLCanvasElement => {
  const offscreen = document.createElement('canvas')
  offscreen.width = PAINTER_CANVAS_SIZE
  offscreen.height = PAINTER_CANVAS_SIZE
  const ctx = offscreen.getContext('2d')!
  drawFunction(ctx, PAINTER_CANVAS_SIZE)
  return offscreen
}

const drawBrickGrid = (
  ctx: CanvasRenderingContext2D,
  size: number,
  fillColor: string,
  baseColor: string
): void => {
  ctx.fillStyle = baseColor
  ctx.fillRect(0, 0, size, size)
  ctx.fillStyle = fillColor
  Array.from({ length: Math.ceil(size / BRICK_HEIGHT) }, (_, row) =>
    Array.from({ length: Math.ceil(size / BRICK_WIDTH) + 1 }, (__, col) => {
      const offset = row % 2 === 0 ? 0 : BRICK_WIDTH / 2
      const brickX = col * BRICK_WIDTH - offset
      ctx.fillRect(brickX, row * BRICK_HEIGHT, MORTAR_SIZE, BRICK_HEIGHT)
      ctx.fillRect(brickX, row * BRICK_HEIGHT, BRICK_WIDTH, MORTAR_SIZE)
      return null
    })
  )
}

const drawNormalMap = (ctx: CanvasRenderingContext2D, size: number): void => {
  const imageData = ctx.createImageData(size, size)
  const neutral = 128
  const blue = 255
  const depressed = 100
  const raised = 156
  Array.from({ length: size * size }, (_, i) => {
    const x = i % size
    const y = Math.floor(i / size)
    const offset = y % (BRICK_HEIGHT * 2) < BRICK_HEIGHT ? 0 : BRICK_WIDTH / 2
    const bx = (x + offset) % BRICK_WIDTH
    const by = y % BRICK_HEIGHT
    const isMortar = bx < MORTAR_SIZE || by < MORTAR_SIZE
    const d = i * 4
    if (isMortar) {
      imageData.data[d] = neutral
      imageData.data[d + 1] = neutral
    } else {
      imageData.data[d] =
        bx < MORTAR_SIZE + MORTAR_EDGE_OFFSET
          ? depressed
          : bx > BRICK_WIDTH - MORTAR_EDGE_OFFSET
            ? raised
            : neutral
      imageData.data[d + 1] =
        by < MORTAR_SIZE + MORTAR_EDGE_OFFSET
          ? depressed
          : by > BRICK_HEIGHT - MORTAR_EDGE_OFFSET
            ? raised
            : neutral
    }
    imageData.data[d + 2] = blue
    imageData.data[d + 3] = blue
    return null
  })
  ctx.putImageData(imageData, 0, 0)
}

const drawAoMap = (ctx: CanvasRenderingContext2D, size: number): void => {
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, size, size)
  ctx.fillStyle = 'rgba(0,0,0,0.4)'
  Array.from({ length: Math.ceil(size / BRICK_HEIGHT) }, (_, row) =>
    Array.from({ length: Math.ceil(size / BRICK_WIDTH) + 1 }, (__, col) => {
      const offset = row % 2 === 0 ? 0 : BRICK_WIDTH / 2
      const brickX = col * BRICK_WIDTH - offset
      ctx.fillRect(brickX, row * BRICK_HEIGHT, MORTAR_SIZE + MORTAR_EDGE_SIZE, BRICK_HEIGHT)
      ctx.fillRect(brickX, row * BRICK_HEIGHT, BRICK_WIDTH, MORTAR_SIZE + MORTAR_EDGE_SIZE)
      return null
    })
  )
}

const drawDisplacementMap = (ctx: CanvasRenderingContext2D, size: number): void => {
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, size, size)
  ctx.fillStyle = '#cccccc'
  Array.from({ length: Math.ceil(size / BRICK_HEIGHT) }, (_, row) =>
    Array.from({ length: Math.ceil(size / BRICK_WIDTH) + 1 }, (__, col) => {
      const offset = row % 2 === 0 ? 0 : BRICK_WIDTH / 2
      const brickX = col * BRICK_WIDTH - offset
      ctx.fillRect(
        brickX + MORTAR_SIZE,
        row * BRICK_HEIGHT + MORTAR_SIZE,
        BRICK_WIDTH - MORTAR_SIZE * 2,
        BRICK_HEIGHT - MORTAR_SIZE * 2
      )
      return null
    })
  )
}

const DEFAULT_DRAW_FUNCTIONS: Record<
  TextureSlotKey,
  (ctx: CanvasRenderingContext2D, size: number) => void
> = {
  diffuse: (ctx, size) => drawBrickGrid(ctx, size, '#cc8866', '#884433'),
  normal: drawNormalMap,
  roughness: (ctx, size) => drawBrickGrid(ctx, size, '#ffffff', '#999999'),
  ao: drawAoMap,
  displacement: drawDisplacementMap,
  emissive: (ctx, size) => drawBrickGrid(ctx, size, '#ff6600', '#000000')
}

const handleTextureLoad = (event: Event): void => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const objectUrl = URL.createObjectURL(file)
  const slot = activeSlot.value
  const offscreen = offscreenCanvases[slot]
  if (!offscreen) return
  const img = new Image()
  img.onload = () => {
    const ctx = offscreen.getContext('2d')!
    ctx.clearRect(0, 0, offscreen.width, offscreen.height)
    ctx.drawImage(img, 0, 0, offscreen.width, offscreen.height)
    textures[slot].needsUpdate = true
    URL.revokeObjectURL(objectUrl)
    const dataUrl = offscreen.toDataURL()
    storageSaveLocal(storageKey(slot), dataUrl)
    pushHistory(slot, dataUrl)
    updatePreviews()
  }
  img.src = objectUrl
  input.value = ''
}

const applyDataUrlToCanvas = (offscreen: HTMLCanvasElement, dataUrl: string): Promise<void> =>
  new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const ctx = offscreen.getContext('2d')!
      ctx.clearRect(0, 0, offscreen.width, offscreen.height)
      ctx.drawImage(img, 0, 0, offscreen.width, offscreen.height)
      resolve()
    }
    img.src = dataUrl
  })

const initTextures = async (): Promise<void> => {
  await Promise.all(
    TEXTURE_SLOTS.map(async (slot) => {
      const saved = storageLoadLocal(storageKey(slot))
      const offscreen = createOffscreenCanvas(DEFAULT_DRAW_FUNCTIONS[slot])
      if (saved?.dataUrl) await applyDataUrlToCanvas(offscreen, saved.dataUrl)
      offscreenCanvases[slot] = offscreen
      const texture = new THREE.CanvasTexture(offscreen)
      texture.wrapS = THREE.RepeatWrapping
      texture.wrapT = THREE.RepeatWrapping
      if (slot === 'diffuse') texture.colorSpace = THREE.SRGBColorSpace
      textures[slot] = texture
    })
  )
}

const createEnvironmentMap = async (renderer: THREE.WebGLRenderer): Promise<void> => {
  const tex = await new THREE.TextureLoader().loadAsync(lakeUrl)
  tex.mapping = THREE.EquirectangularReflectionMapping
  tex.colorSpace = THREE.SRGBColorSpace
  backgroundTexture = tex

  const pmrem = new THREE.PMREMGenerator(renderer)
  pmrem.compileEquirectangularShader()
  envMap = pmrem.fromEquirectangular(tex).texture
  pmrem.dispose()
}

const applyStrengths = (mat: THREE.Material): void => {
  const s = reactiveConfig.value.config
  const m = mat as THREE.MeshStandardMaterial
  if (m.normalMap && m.normalScale) m.normalScale.set(s.normalScale, s.normalScale)
  if (m.aoMap) m.aoMapIntensity = s.aoIntensity
  if ('displacementMap' in m && m.displacementMap)
    (m as unknown as { displacementScale: number }).displacementScale = s.displacementScale
  if (m.emissiveMap) m.emissiveIntensity = s.emissiveIntensity
  if (m.envMap) m.envMapIntensity = s.envMapIntensity
}

const buildSphereMaterial = (): THREE.Material => {
  const mat = buildMaterial(
    reactiveConfig.value.materialType,
    MATERIAL_FEATURES[reactiveConfig.value.materialType],
    getEnabledMaps(reactiveConfig.value.materials),
    reactiveConfig.value.materials,
    { textures: textures as Record<string, THREE.Texture>, envMap }
  ) as THREE.MeshStandardMaterial
  applyStrengths(mat)
  return mat
}

const rebuildMaterial = (): void => {
  if (!sphere) return
  const old = sphere.material as THREE.Material
  sphere.material = buildSphereMaterial()
  old.dispose()
}

const pushHistory = (slot: TextureSlotKey, dataUrl: string): void => {
  const h = paintHistory[slot]
  h.stack = h.stack.slice(0, h.index + 1)
  h.stack.push(dataUrl)
  if (h.stack.length > HISTORY_LIMIT) h.stack.shift()
  else h.index++
}

const applySnapshot = (slot: TextureSlotKey, dataUrl: string): void => {
  applyDataUrlToCanvas(offscreenCanvases[slot], dataUrl).then(() => {
    textures[slot].needsUpdate = true
    storageSaveLocal(storageKey(slot), dataUrl)
  })
}

const undoPaint = (): void => {
  const slot = activeSlot.value
  const h = paintHistory[slot]
  if (h.index <= 0) return
  h.index--
  applySnapshot(slot, h.stack[h.index])
}

const redoPaint = (): void => {
  const slot = activeSlot.value
  const h = paintHistory[slot]
  if (h.index >= h.stack.length - 1) return
  h.index++
  applySnapshot(slot, h.stack[h.index])
}

const floodFill = (
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  fillColor: string
): void => {
  const { width, height } = ctx.canvas
  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data
  const ix = Math.round(startX)
  const iy = Math.round(startY)
  if (ix < 0 || ix >= width || iy < 0 || iy >= height) return
  const startIndex = (iy * width + ix) * 4
  const [tr, tg, tb, ta] = [
    data[startIndex],
    data[startIndex + 1],
    data[startIndex + 2],
    data[startIndex + 3]
  ]
  const temporary = document.createElement('canvas')
  temporary.width = 1
  temporary.height = 1
  const temporaryContext = temporary.getContext('2d')!
  temporaryContext.fillStyle = fillColor
  temporaryContext.fillRect(0, 0, 1, 1)
  const [fr, fg, fb, fa] = [...temporaryContext.getImageData(0, 0, 1, 1).data]
  if (tr === fr && tg === fg && tb === fb && ta === fa) return
  const isSame = (i: number): boolean =>
    data[i] === tr && data[i + 1] === tg && data[i + 2] === tb && data[i + 3] === ta
  const queue: number[] = [ix + iy * width]
  const visited = new Uint8Array(width * height)
  while (queue.length > 0) {
    const pos = queue.pop()!
    if (visited[pos]) continue
    visited[pos] = 1
    const px = pos % width
    const py = Math.floor(pos / width)
    const i = pos * 4
    if (!isSame(i)) continue
    data[i] = fr
    data[i + 1] = fg
    data[i + 2] = fb
    data[i + 3] = fa
    if (px > 0) queue.push(pos - 1)
    if (px < width - 1) queue.push(pos + 1)
    if (py > 0) queue.push(pos - width)
    if (py < height - 1) queue.push(pos + width)
  }
  ctx.putImageData(imageData, 0, 0)
}

const paintStroke = (fromUv: THREE.Vector2 | null, toUv: THREE.Vector2): void => {
  const slot = activeSlot.value
  const offscreen = offscreenCanvases[slot]
  if (!offscreen) return
  const ctx = offscreen.getContext('2d')!
  const size = offscreen.width
  const toX = toUv.x * size
  const toY = (1 - toUv.y) * size

  if (activeTool.value === 'fill') {
    floodFill(ctx, toX, toY, brushColor.value)
  } else {
    const isEraser = activeTool.value === 'eraser'
    ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over'
    const color = isEraser ? 'rgba(0,0,0,1)' : brushColor.value
    ctx.fillStyle = color
    ctx.strokeStyle = color
    ctx.lineWidth = brushSize.value
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    if (fromUv) {
      ctx.moveTo(fromUv.x * size, (1 - fromUv.y) * size)
      ctx.lineTo(toX, toY)
      ctx.stroke()
    }
    ctx.beginPath()
    ctx.arc(toX, toY, brushSize.value / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalCompositeOperation = 'source-over'
  }

  textures[slot].needsUpdate = true
  didPaint = true
}

const resetSlot = (slot: TextureSlotKey): void => {
  const offscreen = offscreenCanvases[slot]
  if (!offscreen) return
  const ctx = offscreen.getContext('2d')!
  ctx.clearRect(0, 0, offscreen.width, offscreen.height)
  DEFAULT_DRAW_FUNCTIONS[slot](ctx, offscreen.width)
  textures[slot].needsUpdate = true
  const dataUrl = offscreen.toDataURL()
  storageSaveLocal(storageKey(slot), dataUrl)
  pushHistory(slot, dataUrl)
  updatePreviews()
}

const resetTexture = (): void => resetSlot(activeSlot.value)

const resetAll = (): void => TEXTURE_SLOTS.forEach(resetSlot)

const getIntersection = (event: MouseEvent): THREE.Intersection | null => {
  if (!orthoCamera || !sphere || !canvasElement) return null
  const rect = canvasElement.getBoundingClientRect()
  const ndc = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1
  )
  const raycaster = new THREE.Raycaster()
  raycaster.setFromCamera(ndc, orthoCamera)
  const hits = raycaster.intersectObject(sphere)
  return hits[0] ?? null
}

const handleMouseDown = (event: MouseEvent): void => {
  if (!canvasElement) return
  const hit = getIntersection(event)

  const isPaintTool = activeTool.value !== 'rotate'
  if (isPaintTool && hit?.uv) {
    activeMode = 'paint'
    lastPaintUv = null
    didPaint = false
    paintStroke(null, hit.uv)
    lastPaintUv = hit.uv.clone()
    canvasElement.style.cursor = 'crosshair'
    return
  }

  if (hit) {
    activeMode = 'rotate'
    dragLastX = event.clientX
    dragLastY = event.clientY
    canvasElement.style.cursor = 'grabbing'
  }
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
  if (!sphere || !canvasElement) return

  if (activeMode === 'paint') {
    const hit = getIntersection(event)
    if (hit?.uv) {
      paintStroke(lastPaintUv, hit.uv)
      lastPaintUv = hit.uv.clone()
    }
    return
  }

  if (activeMode === 'rotate') {
    const dx = event.clientX - dragLastX
    const dy = event.clientY - dragLastY
    const DRAG_SENSITIVITY = 0.008
    sphere.rotation.y += dx * DRAG_SENSITIVITY
    sphere.rotation.x += dy * DRAG_SENSITIVITY
    dragLastX = event.clientX
    dragLastY = event.clientY
    return
  }

  const hit = getIntersection(event)
  const isPaint = activeTool.value !== 'rotate'
  canvasElement.style.cursor = hit ? (isPaint ? 'crosshair' : 'grab') : 'default'
}

const createOrthoCamera = (): THREE.OrthographicCamera => {
  const aspect = window.innerWidth / window.innerHeight
  const halfWidth = PAINTER_ORTHO_FRUSTUM * aspect
  const cam = new THREE.OrthographicCamera(
    -halfWidth,
    halfWidth,
    PAINTER_ORTHO_FRUSTUM,
    -PAINTER_ORTHO_FRUSTUM,
    PAINTER_ORTHO_NEAR,
    PAINTER_ORTHO_FAR
  )
  cam.position.set(0, 0, PAINTER_ORTHO_DISTANCE)
  cam.lookAt(0, 0, 0)
  return cam
}

const handleResize = (): void => {
  if (!rendererReference || !orthoCamera) return
  const width = window.innerWidth
  const height = window.innerHeight
  rendererReference.setSize(width, height)
  const aspect = width / height
  const halfWidth = PAINTER_ORTHO_FRUSTUM * aspect
  orthoCamera.left = -halfWidth
  orthoCamera.right = halfWidth
  orthoCamera.updateProjectionMatrix()
}

const init = async (canvasReference: HTMLCanvasElement): Promise<void> => {
  canvasElement = canvasReference
  await initTextures()
  TEXTURE_SLOTS.forEach((slot) => {
    const initialDataUrl = offscreenCanvases[slot].toDataURL()
    paintHistory[slot].stack = [initialDataUrl]
    paintHistory[slot].index = 0
  })
  updatePreviews()

  const { setup, renderer, scene } = await getTools({ canvas: canvasReference, resize: false })
  rendererReference = renderer
  await createEnvironmentMap(renderer)
  orthoCamera = createOrthoCamera()

  orbitControls = new OrbitControls(orthoCamera, renderer.domElement)
  orbitControls.enableRotate = false
  orbitControls.target.set(0, 0, 0)
  orbitControls.update()

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
      const geometry = new THREE.SphereGeometry(
        PAINTER_SPHERE_RADIUS,
        SPHERE_SEGMENT_COUNT,
        SPHERE_SEGMENT_COUNT
      )
      geometry.setAttribute('uv2', geometry.attributes['uv'])
      sphere = new THREE.Mesh(geometry, buildSphereMaterial())
      sphere.castShadow = true
      sphere.receiveShadow = true
      scene.add(sphere)

      const directionalLight =
        scene.children.find(
          (child): child is THREE.DirectionalLight => child instanceof THREE.DirectionalLight
        ) ?? null

      let frameCount = 0
      const timelineManager = createTimelineManager()

      timelineManager.addAction({
        name: 'Light orbit',
        category: 'animation',
        action: () => {
          if (directionalLight) {
            const angle = (frameCount * PAINTER_LIGHT_ORBIT_SPEED) / PAINTER_TARGET_FPS
            directionalLight.position.set(
              Math.sin(angle) * LIGHT_ORBIT_RADIUS,
              Math.cos(angle) * LIGHT_ORBIT_RADIUS,
              LIGHT_Z_POSITION
            )
          }
        }
      })
      timelineManager.addAction({
        name: 'Render',
        category: 'render',
        action: () => {
          orbitControls?.update()
          if (orthoCamera) renderer.render(scene, orthoCamera)
        }
      })

      const animateLoop = (): void => {
        requestAnimationFrame(animateLoop)
        animateTimeline(timelineManager, frameCount++)
      }
      animateLoop()
    }
  })

  if (backgroundTexture) scene.background = backgroundTexture
}

onMounted(async () => {
  setViewPanels({ showConfig: true })
  usePanelsStore().openPanel('config')
  registerViewConfig(route.name as string, reactiveConfig as never, configControls, rebuildMaterial)
  if (canvas.value) await init(canvas.value)
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  clearViewPanels()
  unregisterViewConfig(route.name as string)
  window.removeEventListener('resize', handleResize)
  if (canvasElement) {
    canvasElement.removeEventListener('mousedown', handleMouseDown)
    canvasElement.removeEventListener('mouseup', handleMouseUp)
    canvasElement.removeEventListener('mousemove', handleMouseMove)
  }
  orbitControls?.dispose()
  Object.values(textures).forEach((t) => t.dispose())
  if (envMap) envMap.dispose()
  if (backgroundTexture) backgroundTexture.dispose()
  sphere = null
  canvasElement = null
})
</script>

<template>
  <div class="texture-painter">
    <canvas ref="canvas"></canvas>
    <div class="texture-painter__strip">
      <img
        v-for="slot in TEXTURE_SLOTS"
        :key="slot"
        :src="previewUrls[slot]"
        class="texture-painter__preview"
        :class="{ 'texture-painter__preview--active': activeSlot === slot }"
        :title="TEXTURE_SLOT_LABELS[slot]"
        :alt="TEXTURE_SLOT_LABELS[slot]"
        @click="activeSlot = slot"
      />
    </div>
  </div>

  <Teleport defer to="#config-panel-extra">
    <div class="texture-painter-toolbar">
      <p class="texture-painter-toolbar__label">Texture</p>
      <div class="texture-painter-toolbar__slots">
        <button
          v-for="slot in TEXTURE_SLOTS"
          :key="slot"
          class="texture-painter-toolbar__slot-btn"
          :class="{ 'texture-painter-toolbar__slot-btn--active': activeSlot === slot }"
          @click="activeSlot = slot"
        >
          {{ TEXTURE_SLOT_LABELS[slot] }}
        </button>
      </div>

      <div class="texture-painter-toolbar__palette">
        <button
          v-for="color in TEXTURE_SLOT_PALETTE[activeSlot]"
          :key="color"
          class="texture-painter-toolbar__swatch"
          :class="{ 'texture-painter-toolbar__swatch--active': brushColor === color }"
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

      <div class="texture-painter-toolbar__resets">
        <button class="texture-painter-toolbar__reset-btn" @click="resetTexture">
          Reset texture
        </button>
        <button class="texture-painter-toolbar__reset-btn" @click="resetAll">Reset all</button>
      </div>

      <label class="texture-painter-toolbar__load-label">
        Load image
        <input
          type="file"
          accept="image/*"
          class="texture-painter-toolbar__load-input"
          @change="handleTextureLoad"
        />
      </label>
    </div>
  </Teleport>
</template>

<style scoped>
.texture-painter {
  position: relative;
  width: 100%;
  height: 100vh;
}

canvas {
  display: block;
  width: 100%;
  height: 100vh;
}

.texture-painter__strip {
  position: absolute;
  bottom: var(--spacing-4);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: var(--spacing-2);
  padding: var(--spacing-2);
  background: rgba(0, 0, 0, 0.55);
  border-radius: var(--radius-md);
  backdrop-filter: blur(4px);
}

.texture-painter__preview {
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

.texture-painter__preview:hover {
  border-color: var(--color-muted-foreground);
}

.texture-painter__preview--active {
  border-color: var(--color-primary);
}

.texture-painter-toolbar {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  padding-top: var(--spacing-3);
  border-top: 1px solid var(--color-border);
}

.texture-painter-toolbar__label {
  font-size: var(--font-size-xs);
  font-weight: 500;
  color: var(--color-foreground);
  margin: 0;
}

.texture-painter-toolbar__slots {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-1);
}

.texture-painter-toolbar__slot-btn {
  padding: var(--spacing-1) var(--spacing-2);
  font-size: var(--font-size-xs);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-secondary);
  color: var(--color-muted-foreground);
  cursor: pointer;
}

.texture-painter-toolbar__slot-btn:hover {
  color: var(--color-foreground);
  background: var(--color-muted);
}

.texture-painter-toolbar__slot-btn--active {
  color: var(--color-foreground);
  background: var(--color-muted);
  border-color: var(--color-primary);
}

.texture-painter-toolbar__load-label {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
  font-size: var(--font-size-xs);
  font-weight: 500;
  color: var(--color-foreground);
  cursor: pointer;
}

.texture-painter-toolbar__load-input {
  font-size: var(--font-size-xs);
  color: var(--color-muted-foreground);
  cursor: pointer;
}

.texture-painter-toolbar__load-input::file-selector-button {
  font-size: var(--font-size-xs);
  padding: var(--spacing-1) var(--spacing-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-secondary);
  color: var(--color-muted-foreground);
  cursor: pointer;
}

.texture-painter-toolbar__palette {
  display: flex;
  gap: var(--spacing-1);
  flex-wrap: wrap;
}

.texture-painter-toolbar__swatch {
  width: 1.5rem;
  height: 1.5rem;
  border-radius: var(--radius-sm);
  border: 2px solid transparent;
  cursor: pointer;
  padding: 0;
}

.texture-painter-toolbar__swatch--active {
  border-color: var(--color-foreground);
}

.texture-painter-toolbar__swatch:hover {
  opacity: 0.85;
}

.texture-painter-toolbar__resets {
  display: flex;
  gap: var(--spacing-1);
}

.texture-painter-toolbar__reset-btn {
  flex: 1;
  padding: var(--spacing-1) var(--spacing-2);
  font-size: var(--font-size-xs);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-secondary);
  color: var(--color-muted-foreground);
  cursor: pointer;
}

.texture-painter-toolbar__reset-btn:hover {
  color: var(--color-foreground);
  background: var(--color-muted);
}
</style>
