<script setup lang="ts">
import * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { getBall, getCube, getCylinder, getTools, disposeObject } from '@webgamekit/threejs'
import type { CoordinateTuple, LoadProgress } from '@webgamekit/threejs'
import { createTimelineManager } from '@webgamekit/animation'
import LoadingOverlay from '@/components/LoadingOverlay.vue'
import { createReactiveConfig, registerViewConfig, unregisterViewConfig } from '@/stores/viewConfig'
import { useViewPanelsStore } from '@/stores/viewPanels'
import { usePanelsStore } from '@/stores/panels'
import { useDebugSceneStore } from '@/stores/debugScene'
import { useElementPropertiesStore } from '@/stores/elementProperties'
import { useCameraConfigStore } from '@/stores/cameraConfig'
import { registerCameraProperties } from '@/utils/cameraProperties'
import { createObjectPropertiesConfig } from '@/utils/objectProperties'
import { toggleObjectVisibility } from '@/utils/threeObjectUpdaters'
import {
  getCellKey,
  getGridDivisions,
  getGridExtent,
  isDragGesture,
  isInsideGrid,
  snapToCell
} from './grid'
import {
  CAMERA_FAR,
  CAMERA_FRUSTUM_HEIGHT,
  CAMERA_NEAR,
  CAMERA_POSITION,
  DRAG_THRESHOLD_PIXELS,
  ERASE_MODEL,
  GRID_CENTER_COLOR,
  GRID_ELEVATION,
  GRID_LINE_COLOR,
  GROUND_SIZE,
  HIGHLIGHT_COLOR,
  HIGHLIGHT_HEIGHT,
  HIGHLIGHT_OPACITY,
  MODEL_PALETTE,
  cameraSchema,
  configControls,
  defaultConfig,
  sceneSetupConfig
} from './config'
import type { PlaceableModel } from './types'

const canvas = ref<HTMLCanvasElement | null>(null)
const loadingVisible = ref(true)
const loadingStage = ref('Loading…')
const loadingDetail = ref<string | undefined>(undefined)
const handleProgress = (progress: LoadProgress): void => {
  loadingVisible.value = !progress.done
  loadingStage.value = progress.stage
  loadingDetail.value = progress.detail
}

const route = useRoute()
const { setViewPanels, clearViewPanels } = useViewPanelsStore()
const { openPanel } = usePanelsStore()
const debugSceneStore = useDebugSceneStore()
const { clearAllElementProperties } = useElementPropertiesStore()
const { unregisterCameraHandlers } = useCameraConfigStore()
const reactiveConfig = createReactiveConfig(defaultConfig)

const raycaster = new THREE.Raycaster()
const pointerPosition = new THREE.Vector2()
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
const groundHit = new THREE.Vector3()
const placedModels = new Map<string, THREE.Mesh>()

let sceneReference: THREE.Scene | null = null
let worldReference: RAPIER.World | null = null
let cameraReference: THREE.OrthographicCamera | null = null
let gridHelper: THREE.GridHelper | null = null
let cellHighlight: THREE.Mesh | null = null
let cleanupTools: (() => void) | null = null
let pointerDownAt: [number, number] | null = null
let appliedCellSize = 0
let gridExtent = getGridExtent(GROUND_SIZE, defaultConfig.grid.cellSize)

const createIsometricCamera = (): THREE.OrthographicCamera => {
  const halfHeight = CAMERA_FRUSTUM_HEIGHT / 2
  const halfWidth = halfHeight * (window.innerWidth / window.innerHeight)
  const camera = new THREE.OrthographicCamera(
    -halfWidth,
    halfWidth,
    halfHeight,
    -halfHeight,
    CAMERA_NEAR,
    CAMERA_FAR
  )
  camera.position.set(...CAMERA_POSITION)
  camera.lookAt(0, 0, 0)
  return camera
}

const createCellHighlight = (scene: THREE.Scene): THREE.Mesh => {
  const highlight = new THREE.Mesh(
    new THREE.BoxGeometry(1, HIGHLIGHT_HEIGHT, 1),
    new THREE.MeshBasicMaterial({
      color: HIGHLIGHT_COLOR,
      transparent: true,
      opacity: HIGHLIGHT_OPACITY
    })
  )
  highlight.name = 'cell-highlight'
  highlight.visible = false
  scene.add(highlight)
  return highlight
}

/** Redraws the grid when the cell size changes, leaving models already placed where they are. */
const syncGrid = (): void => {
  const { cellSize } = reactiveConfig.value.grid
  if (!sceneReference || cellSize === appliedCellSize) return
  appliedCellSize = cellSize
  gridExtent = getGridExtent(GROUND_SIZE, cellSize)

  if (gridHelper) {
    sceneReference.remove(gridHelper)
    gridHelper.dispose()
  }
  gridHelper = new THREE.GridHelper(
    gridExtent,
    getGridDivisions(GROUND_SIZE, cellSize),
    GRID_CENTER_COLOR,
    GRID_LINE_COLOR
  )
  gridHelper.name = 'placement-grid'
  gridHelper.position.setY(GRID_ELEVATION)
  sceneReference.add(gridHelper)
  cellHighlight?.scale.set(cellSize, 1, cellSize)
}

const getGroundPoint = (event: PointerEvent): THREE.Vector3 | null => {
  if (!cameraReference || !canvas.value) return null
  const bounds = canvas.value.getBoundingClientRect()
  pointerPosition.set(
    ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
    -((event.clientY - bounds.top) / bounds.height) * 2 + 1
  )
  raycaster.setFromCamera(pointerPosition, cameraReference)
  return raycaster.ray.intersectPlane(groundPlane, groundHit)
}

const buildModel = (
  scene: THREE.Scene,
  world: RAPIER.World,
  model: PlaceableModel,
  position: { x: number; z: number; cellSize: number },
  name: string
): THREE.Mesh => {
  const { x, z, cellSize } = position
  const [cellsWide, cellsTall, cellsDeep] = model.size
  const options = { name, color: model.color, type: 'fixed' as const }

  if (model.shape === 'ball') {
    const radius = (cellsWide * cellSize) / 2
    return getBall(scene, world, { ...options, size: radius, position: [x, radius, z] })
  }

  const size: CoordinateTuple = [cellsWide * cellSize, cellsTall * cellSize, cellsDeep * cellSize]
  const getShape = model.shape === 'cube' ? getCube : getCylinder
  return getShape(scene, world, { ...options, size, position: [x, 0, z] })
}

const removePlacedModel = (cellKey: string): void => {
  const mesh = placedModels.get(cellKey)
  if (!mesh || !sceneReference) return
  sceneReference.remove(mesh)
  if (worldReference && mesh.userData.body) worldReference.removeRigidBody(mesh.userData.body)
  disposeObject(mesh)
  placedModels.delete(cellKey)
  debugSceneStore.removeSceneElement(mesh.name)
}

const placeModel = (model: PlaceableModel, cellKey: string, x: number, z: number): void => {
  if (!sceneReference || !worldReference) return
  removePlacedModel(cellKey)

  const { cellSize } = reactiveConfig.value.grid
  const name = [model.value, cellKey].join('_')
  const mesh = buildModel(sceneReference, worldReference, model, { x, z, cellSize }, name)
  const properties = createObjectPropertiesConfig(mesh, name)

  placedModels.set(cellKey, mesh)
  debugSceneStore.addSceneElement(
    { name, type: model.label, hidden: false },
    {
      ...properties,
      updateValue: (path, value) => {
        properties.updateValue(path, value)
        mesh.userData.body?.setTranslation(mesh.position, true)
      }
    }
  )
}

const clearAll = (): void => {
  ;[...placedModels.keys()].forEach(removePlacedModel)
}

const handleToggleVisibility = (name: string): void => {
  const object = sceneReference?.getObjectByName(name)
  if (object) toggleObjectVisibility(object)
}

const handleRemove = (name: string): void => {
  const entry = [...placedModels].find(([, mesh]) => mesh.name === name)
  if (entry) removePlacedModel(entry[0])
}

const handlePointerDown = (event: PointerEvent): void => {
  pointerDownAt = [event.clientX, event.clientY]
}

const handlePointerMove = (event: PointerEvent): void => {
  if (!cellHighlight) return
  const { cellSize } = reactiveConfig.value.grid
  const point = getGroundPoint(event)
  cellHighlight.visible = Boolean(point) && isInsideGrid(point?.x ?? 0, point?.z ?? 0, gridExtent)
  if (!point || !cellHighlight.visible) return
  cellHighlight.position.set(
    snapToCell(point.x, cellSize),
    HIGHLIGHT_HEIGHT / 2,
    snapToCell(point.z, cellSize)
  )
}

const handlePointerUp = (event: PointerEvent): void => {
  const startedAt = pointerDownAt
  pointerDownAt = null
  if (!startedAt) return
  const endedAt: [number, number] = [event.clientX, event.clientY]
  if (isDragGesture(startedAt, endedAt, DRAG_THRESHOLD_PIXELS)) return

  const { cellSize } = reactiveConfig.value.grid
  const point = getGroundPoint(event)
  if (!point || !isInsideGrid(point.x, point.z, gridExtent)) return

  const cellKey = getCellKey(point.x, point.z, cellSize)
  if (reactiveConfig.value.model === ERASE_MODEL) {
    removePlacedModel(cellKey)
    return
  }

  const model = MODEL_PALETTE.find((entry) => entry.value === reactiveConfig.value.model)
  if (model) {
    placeModel(model, cellKey, snapToCell(point.x, cellSize), snapToCell(point.z, cellSize))
  }
}

const initScene = async (): Promise<void> => {
  if (!canvas.value) return
  const { setup, animate, scene, world, renderer, cleanup, setActiveCamera } = await getTools({
    canvas: canvas.value,
    onProgress: handleProgress
  })
  sceneReference = scene
  worldReference = world
  cleanupTools = cleanup

  const { elements } = await setup({ config: sceneSetupConfig })

  cameraReference = createIsometricCamera()
  const orbit = setActiveCamera(cameraReference)

  cellHighlight = createCellHighlight(scene)
  syncGrid()

  debugSceneStore.registerSceneElements(
    cameraReference,
    elements,
    { onToggleVisibility: handleToggleVisibility, onRemove: handleRemove },
    { renderer, orbit }
  )
  // An orthographic camera has no field of view, so `registerSceneElements` skips it and the
  // Camera row would open on an empty panel. Register the controls it does have by hand.
  registerCameraProperties({ camera: cameraReference, orbit, renderer, schema: cameraSchema })

  canvas.value.addEventListener('pointerdown', handlePointerDown)
  canvas.value.addEventListener('pointermove', handlePointerMove)
  canvas.value.addEventListener('pointerup', handlePointerUp)

  animate({ timeline: createTimelineManager() })
}

onMounted(() => {
  setViewPanels({ showConfig: true, showElements: true })
  registerViewConfig(route.name as string, reactiveConfig, configControls, syncGrid, { clearAll })
  openPanel('config')
  initScene()
})

onBeforeUnmount(() => {
  canvas.value?.removeEventListener('pointerdown', handlePointerDown)
  canvas.value?.removeEventListener('pointermove', handlePointerMove)
  canvas.value?.removeEventListener('pointerup', handlePointerUp)
  clearAll()
  if (sceneReference && gridHelper) {
    sceneReference.remove(gridHelper)
    gridHelper.dispose()
  }
  if (sceneReference && cellHighlight) {
    sceneReference.remove(cellHighlight)
    disposeObject(cellHighlight)
  }
  cleanupTools?.()
  clearViewPanels()
  debugSceneStore.clearSceneElements()
  clearAllElementProperties()
  unregisterCameraHandlers()
  unregisterViewConfig(route.name as string)
})
</script>

<template>
  <canvas ref="canvas"></canvas>
  <LoadingOverlay :visible="loadingVisible" :stage="loadingStage" :detail="loadingDetail" />
</template>
