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

type InteractionMode = 'paint' | 'rotate'
let interactionMode: InteractionMode = 'none' as InteractionMode
let lastPaintUv: THREE.Vector2 | null = null
let dragLastX = 0
let dragLastY = 0

const textures: Record<string, THREE.CanvasTexture> = {}
const offscreenCanvases: Record<string, HTMLCanvasElement> = {}

const reactiveConfig = createReactiveConfig<
  MaterialsListConfig & {
    materialType: MaterialTypeName
    activeSlot: TextureSlotKey
    brushColor: string
    brushSize: number
    mode: InteractionMode
  }
>({
  materialType: 'MeshStandardMaterial',
  activeSlot: 'diffuse',
  brushColor: TEXTURE_SLOT_DEFAULT_COLOR.diffuse,
  brushSize: 20,
  mode: 'paint',
  ...DEFAULT_CONFIG
})

const configControls = {
  mode: {
    label: 'Mode',
    component: 'ButtonSelector' as const,
    options: [
      { value: 'paint', label: 'Paint' },
      { value: 'rotate', label: 'Rotate' }
    ]
  },
  materialType: {
    label: 'Material',
    component: 'ButtonSelector' as const,
    options: MAIN_MATERIAL_TYPES.map((t) => ({ value: t, label: MATERIAL_LABELS[t] }))
  },
  activeSlot: {
    label: 'Paint on',
    component: 'ButtonSelector' as const,
    options: TEXTURE_SLOTS.map((s) => ({ value: s, label: TEXTURE_SLOT_LABELS[s] }))
  },
  brushColor: { color: true, label: 'Color' },
  brushSize: { min: 1, max: 80, step: 1, label: 'Brush Size' },
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

const DEFAULT_DRAW_FUNCTIONS: Record<
  TextureSlotKey,
  (ctx: CanvasRenderingContext2D, size: number) => void
> = {
  diffuse: (ctx, size) => drawBrickGrid(ctx, size, '#cc8866', '#884433'),
  normal: (ctx, size) => {
    ctx.fillStyle = '#8080ff'
    ctx.fillRect(0, 0, size, size)
  },
  roughness: (ctx, size) => drawBrickGrid(ctx, size, '#ffffff', '#999999'),
  ao: (ctx, size) => {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, size, size)
  },
  displacement: (ctx, size) => {
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, size, size)
  },
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
  const slot = reactiveConfig.value.activeSlot
  const offscreen = offscreenCanvases[slot]
  if (!offscreen) return
  const ctx = offscreen.getContext('2d')!
  const size = offscreen.width
  const toX = toUv.x * size
  const toY = (1 - toUv.y) * size
  const radius = reactiveConfig.value.brushSize / 2

  ctx.fillStyle = reactiveConfig.value.brushColor
  ctx.strokeStyle = reactiveConfig.value.brushColor
  ctx.lineWidth = reactiveConfig.value.brushSize
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

  if (reactiveConfig.value.mode === 'paint' && hit?.uv) {
    interactionMode = 'paint'
    lastPaintUv = null
    paintStroke(null, hit.uv)
    lastPaintUv = hit.uv.clone()
    canvasElement.style.cursor = 'crosshair'
    return
  }

  if (hit) {
    interactionMode = 'rotate'
    dragLastX = event.clientX
    dragLastY = event.clientY
    canvasElement.style.cursor = 'grabbing'
  }
}

const handleMouseUp = (): void => {
  interactionMode = 'none' as InteractionMode
  lastPaintUv = null
  if (canvasElement) canvasElement.style.cursor = 'default'
}

const handleMouseMove = (event: MouseEvent): void => {
  if (!sphere || !canvasElement) return

  if (interactionMode === 'paint') {
    const hit = getIntersection(event)
    if (hit?.uv) {
      paintStroke(lastPaintUv, hit.uv)
      lastPaintUv = hit.uv.clone()
    }
    return
  }

  if (interactionMode === 'rotate') {
    const dx = event.clientX - dragLastX
    const dy = event.clientY - dragLastY
    sphere.rotation.y += dx * 0.008
    sphere.rotation.x += dy * 0.008
    dragLastX = event.clientX
    dragLastY = event.clientY
    return
  }

  const hit = getIntersection(event)
  const isPaint = reactiveConfig.value.mode === 'paint'
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
</template>

<style scoped>
canvas {
  display: block;
  width: 100%;
  height: 100vh;
}
</style>
