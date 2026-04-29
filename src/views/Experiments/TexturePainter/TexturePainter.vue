<script setup lang="ts">
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { getTools } from '@webgamekit/threejs'
import { createTimelineManager, animateTimeline } from '@webgamekit/animation'
import { storageSaveLocal, storageLoadLocal } from '@webgamekit/canvas-editor'
import { registerViewConfig, unregisterViewConfig, createReactiveConfig } from '@/stores/viewConfig'
import { registerSceneConfig, unregisterSceneConfig } from '@/stores/sceneConfig'
import { useViewPanelsStore } from '@/stores/viewPanels'
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
  SCENE_BG_COLOR,
  LIGHT_INTENSITY,
  AMBIENT_LIGHT_INTENSITY,
  HEMISPHERE_SKY,
  HEMISPHERE_GROUND,
  LIGHT_ORBIT_RADIUS,
  LIGHT_Z_POSITION,
  ENV_SKY_COLOR,
  ENV_GROUND_COLOR,
  ENV_GROUND_SIZE,
  ENV_GROUND_Y,
  ENV_LIGHT_INTENSITY,
  ENV_LIGHT_POSITION,
  ENV_LIGHT_Y,
  ENV_AMBIENT_COLOR,
  ENV_AMBIENT_INTENSITY,
  ENV_LIGHT_COLOR,
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
  TEXTURE_SLOT_DEFAULT_COLOR
} from './config'
import type { MaterialTypeName, MaterialsListConfig, TextureSlotKey } from './config'

const canvas = ref<HTMLCanvasElement | null>(null)
const route = useRoute()
const { setViewPanels, clearViewPanels } = useViewPanelsStore()

let sphere: THREE.Mesh | null = null
let envMap: THREE.Texture | null = null
let orbitControls: OrbitControls | null = null
let orthoCamera: THREE.OrthographicCamera | null = null
let rendererReference: THREE.WebGLRenderer | null = null
let canvasElement: HTMLCanvasElement | null = null

type ActiveMode = 'paint' | 'rotate' | 'none'
let activeMode: ActiveMode = 'none'
let lastPaintUv: THREE.Vector2 | null = null
let dragLastX = 0
let dragLastY = 0

const activeTool = ref<DrawingTool>('brush')
const brushColor = ref(TEXTURE_SLOT_DEFAULT_COLOR.diffuse)
const brushSize = ref(20)

const textures: Record<string, THREE.CanvasTexture> = {}
const offscreenCanvases: Record<string, HTMLCanvasElement> = {}

const activeSlot = ref<TextureSlotKey>('diffuse')

const reactiveConfig = createReactiveConfig<
  MaterialsListConfig & { materialType: MaterialTypeName }
>({
  materialType: 'MeshStandardMaterial',
  ...DEFAULT_CONFIG
})

const configControls = {
  materialType: {
    label: 'Material',
    component: 'ButtonSelector' as const,
    options: MAIN_MATERIAL_TYPES.map((t) => ({ value: t, label: MATERIAL_LABELS[t] }))
  },
  properties: CONFIG_SCHEMA.properties
}

const mapsSceneRegistration = {
  schema: { maps: CONFIG_SCHEMA.maps },
  getValue: (path: string): unknown =>
    path
      .split('.')
      .reduce<unknown>(
        (object, key) => (object as Record<string, unknown>)?.[key],
        reactiveConfig.value
      ),
  updateValue: (path: string, value: unknown): void => {
    const [group, key] = path.split('.')
    if (group === 'maps' && key) {
      ;(reactiveConfig.value.maps as Record<string, unknown>)[key] = value
      rebuildMaterial()
    }
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

const createEnvironmentMap = (renderer: THREE.WebGLRenderer): THREE.Texture => {
  const pmremGenerator = new THREE.PMREMGenerator(renderer)
  const envScene = new THREE.Scene()
  envScene.background = new THREE.Color(ENV_SKY_COLOR)
  const groundGeo = new THREE.PlaneGeometry(ENV_GROUND_SIZE, ENV_GROUND_SIZE)
  const groundMat = new THREE.MeshBasicMaterial({ color: ENV_GROUND_COLOR })
  const ground = new THREE.Mesh(groundGeo, groundMat)
  ground.rotation.x = -Math.PI / 2
  ground.position.y = ENV_GROUND_Y
  envScene.add(ground)
  const envLight = new THREE.DirectionalLight(ENV_LIGHT_COLOR, ENV_LIGHT_INTENSITY)
  envLight.position.set(ENV_LIGHT_POSITION, ENV_LIGHT_Y, ENV_LIGHT_POSITION)
  envScene.add(envLight)
  envScene.add(new THREE.AmbientLight(ENV_AMBIENT_COLOR, ENV_AMBIENT_INTENSITY))
  const renderTarget = pmremGenerator.fromScene(envScene, 0)
  pmremGenerator.dispose()
  groundGeo.dispose()
  groundMat.dispose()
  return renderTarget.texture
}

const buildSphereMaterial = (): THREE.Material =>
  buildMaterial(
    reactiveConfig.value.materialType,
    MATERIAL_FEATURES[reactiveConfig.value.materialType],
    getEnabledMaps(reactiveConfig.value),
    reactiveConfig.value,
    { textures: textures as Record<string, THREE.Texture>, envMap }
  )

const rebuildMaterial = (): void => {
  if (!sphere) return
  const old = sphere.material as THREE.Material
  sphere.material = buildSphereMaterial()
  old.dispose()
}

const paintStroke = (fromUv: THREE.Vector2 | null, toUv: THREE.Vector2): void => {
  const slot = activeSlot.value
  const offscreen = offscreenCanvases[slot]
  if (!offscreen) return
  const ctx = offscreen.getContext('2d')!
  const size = offscreen.width
  const toX = toUv.x * size
  const toY = (1 - toUv.y) * size
  const radius = brushSize.value / 2

  ctx.fillStyle = brushColor.value
  ctx.strokeStyle = brushColor.value
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
  ctx.arc(toX, toY, radius, 0, Math.PI * 2)
  ctx.fill()

  textures[slot].needsUpdate = true
  storageSaveLocal(storageKey(slot), offscreen.toDataURL())
}

const resetSlot = (slot: TextureSlotKey): void => {
  const offscreen = offscreenCanvases[slot]
  if (!offscreen) return
  const ctx = offscreen.getContext('2d')!
  ctx.clearRect(0, 0, offscreen.width, offscreen.height)
  DEFAULT_DRAW_FUNCTIONS[slot](ctx, offscreen.width)
  textures[slot].needsUpdate = true
  storageSaveLocal(storageKey(slot), offscreen.toDataURL())
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
  activeMode = 'none'
  lastPaintUv = null
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
    sphere.rotation.y += dx * 0.008
    sphere.rotation.x += dy * 0.008
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

  const { setup, renderer, scene } = await getTools({ canvas: canvasReference, resize: false })
  rendererReference = renderer
  envMap = createEnvironmentMap(renderer)
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
      scene: { backgroundColor: SCENE_BG_COLOR },
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
}

onMounted(async () => {
  setViewPanels({ showConfig: true, showScene: true })
  registerViewConfig(route.name as string, reactiveConfig as never, configControls, rebuildMaterial)
  registerSceneConfig(mapsSceneRegistration)
  if (canvas.value) await init(canvas.value)
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  clearViewPanels()
  unregisterViewConfig(route.name as string)
  unregisterSceneConfig()
  window.removeEventListener('resize', handleResize)
  if (canvasElement) {
    canvasElement.removeEventListener('mousedown', handleMouseDown)
    canvasElement.removeEventListener('mouseup', handleMouseUp)
    canvasElement.removeEventListener('mousemove', handleMouseMove)
  }
  orbitControls?.dispose()
  Object.values(textures).forEach((t) => t.dispose())
  if (envMap) envMap.dispose()
  sphere = null
  canvasElement = null
})
</script>

<template>
  <canvas ref="canvas"></canvas>

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

      <DrawingToolbar
        :tool="activeTool"
        :color="brushColor"
        :size="brushSize"
        :visible-tools="['brush', 'eraser', 'fill', 'rotate', 'color', 'size']"
        @update:tool="activeTool = $event"
        @update:color="brushColor = $event"
        @update:size="brushSize = $event"
      />

      <div class="texture-painter-toolbar__resets">
        <button class="texture-painter-toolbar__reset-btn" @click="resetTexture">
          Reset texture
        </button>
        <button class="texture-painter-toolbar__reset-btn" @click="resetAll">Reset all</button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
canvas {
  display: block;
  width: 100%;
  height: 100vh;
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

<style scoped>
canvas {
  display: block;
  width: 100%;
  height: 100vh;
}
</style>
