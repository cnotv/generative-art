<script setup lang="ts">
import * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { getTools, disposeObject } from '@webgamekit/threejs'
import type { LoadProgress } from '@webgamekit/threejs'
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
import { setOrbitEnabled, toggleObjectVisibility } from '@/utils/threeObjectUpdaters'
import {
  getCellCentre,
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
  GRID_ELEVATION_CELLS,
  GRID_LINE_COLOR,
  GRID_OPACITY,
  BOARD_SIZE_DEFAULT,
  CELL_SIZE,
  HIGHLIGHT_COLOR,
  HIGHLIGHT_HEIGHT,
  HIGHLIGHT_OPACITY,
  CITY_MODELS,
  CITY_PRESET,
  defaultConfig,
  sceneSetupConfig
} from './config'
import { cameraSchema, configControls } from './panelControls'
import { buildCityModel } from './models'
import { getPresetPlacements } from './preset'
import { resolveStrokeMode } from './strokes'
import type { CityModel, PaintMode, PaintTarget } from './types'

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
const partPosition = new THREE.Vector3()
const placedModels = new Map<string, THREE.Group>()

let sceneReference: THREE.Scene | null = null
let worldReference: RAPIER.World | null = null
let cameraReference: THREE.OrthographicCamera | null = null
let gridHelper: THREE.GridHelper | null = null
let cellHighlight: THREE.Mesh | null = null
let cleanupTools: (() => void) | null = null
let groundMesh: THREE.Mesh | null = null
let orbitReference: { enabled: boolean } | null = null
let pointerDownAt: [number, number] | null = null
let strokeMode: PaintMode | null = null
let strokedCellKey: string | null = null
let appliedBoardSize = 0
let gridExtent = getGridExtent(defaultConfig.grid.size, CELL_SIZE)

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

/** Rides at the grid's height, so hovering a road or a river still shows which cell is armed. */
const HIGHLIGHT_ELEVATION = GRID_ELEVATION_CELLS * CELL_SIZE

const createCellHighlight = (scene: THREE.Scene): THREE.Mesh => {
  const highlight = new THREE.Mesh(
    new THREE.BoxGeometry(CELL_SIZE, HIGHLIGHT_HEIGHT, CELL_SIZE),
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

const syncGridVisibility = (): void => {
  if (gridHelper) gridHelper.visible = reactiveConfig.value.grid.show
}

/** Drops whatever a shrunken board no longer covers, rather than leaving it hanging in the air. */
const trimToBoard = (): void => {
  ;[...placedModels]
    .filter(([, group]) => !isInsideGrid(group.position.x, group.position.z, gridExtent))
    .forEach(([cellKey]) => removePlacedModel(cellKey))
}

/**
 * Resizes the board and redraws its grid, leaving the cells themselves alone: components are
 * sized in cells, so a board that grew keeps every placement exactly where it was.
 */
const syncBoard = (): void => {
  const boardSize = reactiveConfig.value.grid.size
  if (!sceneReference || boardSize === appliedBoardSize) return
  appliedBoardSize = boardSize
  gridExtent = getGridExtent(boardSize, CELL_SIZE)

  // The ground is one flat box, so scaling it is the whole resize. Its collider stays the size
  // it was built at, which nothing in an editor reads.
  const groundScale = boardSize / BOARD_SIZE_DEFAULT
  groundMesh?.scale.set(groundScale, 1, groundScale)

  if (gridHelper) {
    sceneReference.remove(gridHelper)
    gridHelper.dispose()
  }
  gridHelper = new THREE.GridHelper(
    gridExtent,
    getGridDivisions(boardSize, CELL_SIZE),
    GRID_CENTER_COLOR,
    GRID_LINE_COLOR
  )
  gridHelper.name = 'placement-grid'
  gridHelper.position.setY(GRID_ELEVATION_CELLS * CELL_SIZE)
  // Solid white lines over a road read as a fence rather than a guide.
  const gridMaterial = gridHelper.material as THREE.Material
  gridMaterial.transparent = true
  gridMaterial.opacity = GRID_OPACITY
  sceneReference.add(gridHelper)
  syncGridVisibility()
  trimToBoard()
}

/** Orbit and painting both live on a drag, so only one of them is listening at a time. */
const syncOrbit = (): void => {
  if (orbitReference) setOrbitEnabled(orbitReference, reactiveConfig.value.orbit)
}

const applyConfig = (): void => {
  syncBoard()
  syncGridVisibility()
  syncOrbit()
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

/**
 * Move each part's collider onto the part, since the group is what the panel moves and a body
 * follows nothing on its own.
 * @param group The placed model
 */
const syncPartBodies = (group: THREE.Group): void => {
  group.updateMatrixWorld(true)
  group.children.forEach((part) => {
    part.getWorldPosition(partPosition)
    part.userData.body?.setTranslation(partPosition, true)
  })
}

const removePlacedModel = (cellKey: string): void => {
  const group = placedModels.get(cellKey)
  if (!group || !sceneReference) return
  group.children.forEach((part) => {
    if (worldReference && part.userData.body) worldReference.removeRigidBody(part.userData.body)
  })
  sceneReference.remove(group)
  disposeObject(group)
  placedModels.delete(cellKey)
  debugSceneStore.removeSceneElement(group.name)
}

const placeModel = (model: CityModel, cellKey: string, x: number, z: number): void => {
  if (!sceneReference || !worldReference) return
  removePlacedModel(cellKey)

  const name = [model.value, cellKey].join('_')
  const group = buildCityModel(sceneReference, worldReference, model, CELL_SIZE, name)
  group.position.set(x, 0, z)
  syncPartBodies(group)

  const properties = createObjectPropertiesConfig(group, name)
  placedModels.set(cellKey, group)
  debugSceneStore.addSceneElement(
    { name, type: model.label, hidden: false },
    {
      ...properties,
      updateValue: (path, value) => {
        properties.updateValue(path, value)
        syncPartBodies(group)
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
  const entry = [...placedModels].find(([, group]) => group.name === name)
  if (entry) removePlacedModel(entry[0])
}

const resolveCell = (event: PointerEvent): PaintTarget | null => {
  const point = getGroundPoint(event)
  if (!point || !isInsideGrid(point.x, point.z, gridExtent)) return null
  return {
    cellKey: getCellKey(point.x, point.z, CELL_SIZE),
    x: snapToCell(point.x, CELL_SIZE),
    z: snapToCell(point.z, CELL_SIZE)
  }
}

const getStrokeMode = (cellKey: string): PaintMode =>
  resolveStrokeMode(
    reactiveConfig.value.model,
    placedModels.get(cellKey)?.userData.model,
    ERASE_MODEL
  )

const applyToCell = ({ cellKey, x, z }: PaintTarget, mode: PaintMode): void => {
  if (mode === 'erasing') {
    removePlacedModel(cellKey)
    return
  }
  const model = CITY_MODELS.find((entry) => entry.value === reactiveConfig.value.model)
  if (model) placeModel(model, cellKey, x, z)
}

const endStroke = (): void => {
  strokeMode = null
  strokedCellKey = null
}

const handlePointerDown = (event: PointerEvent): void => {
  pointerDownAt = [event.clientX, event.clientY]
  if (reactiveConfig.value.orbit) return

  const target = resolveCell(event)
  if (!target) return
  strokeMode = getStrokeMode(target.cellKey)
  strokedCellKey = target.cellKey
  applyToCell(target, strokeMode)
}

const handlePointerMove = (event: PointerEvent): void => {
  const point = getGroundPoint(event)
  const onGrid = Boolean(point) && isInsideGrid(point?.x ?? 0, point?.z ?? 0, gridExtent)
  if (cellHighlight) cellHighlight.visible = onGrid
  if (!point || !onGrid) return

  const x = snapToCell(point.x, CELL_SIZE)
  const z = snapToCell(point.z, CELL_SIZE)
  cellHighlight?.position.set(x, HIGHLIGHT_ELEVATION, z)

  if (!strokeMode) return
  const cellKey = getCellKey(point.x, point.z, CELL_SIZE)
  if (cellKey === strokedCellKey) return
  strokedCellKey = cellKey
  applyToCell({ cellKey, x, z }, strokeMode)
}

const handlePointerUp = (event: PointerEvent): void => {
  const startedAt = pointerDownAt
  pointerDownAt = null
  if (strokeMode) {
    endStroke()
    return
  }

  // Orbit is on, so a drag belongs to the camera and only a click reaches the board.
  if (!startedAt) return
  const endedAt: [number, number] = [event.clientX, event.clientY]
  if (isDragGesture(startedAt, endedAt, DRAG_THRESHOLD_PIXELS)) return
  const target = resolveCell(event)
  if (target) applyToCell(target, getStrokeMode(target.cellKey))
}

const loadPreset = (): void => {
  clearAll()
  reactiveConfig.value.grid.size = CITY_PRESET.boardSize
  syncBoard()

  getPresetPlacements(CITY_PRESET).forEach(({ model: value, cell: [cellX, cellZ] }) => {
    const model = CITY_MODELS.find((entry) => entry.value === value)
    if (!model) return
    const x = getCellCentre(cellX, CELL_SIZE)
    const z = getCellCentre(cellZ, CELL_SIZE)
    placeModel(model, getCellKey(x, z, CELL_SIZE), x, z)
  })
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

  const { elements, ground } = await setup({ config: sceneSetupConfig })
  groundMesh = ground?.mesh ?? null

  cameraReference = createIsometricCamera()
  const orbit = setActiveCamera(cameraReference)

  orbitReference = orbit
  cellHighlight = createCellHighlight(scene)
  applyConfig()

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
  // A stroke that ends off the canvas never reports its pointerup, and would otherwise keep
  // painting when the pointer came back.
  canvas.value.addEventListener('pointerleave', endStroke)

  animate({ timeline: createTimelineManager() })
}

onMounted(() => {
  setViewPanels({ showConfig: true, showElements: true })
  registerViewConfig(route.name as string, reactiveConfig, configControls, applyConfig, {
    clearAll,
    loadPreset
  })
  openPanel('config')
  initScene()
})

onBeforeUnmount(() => {
  canvas.value?.removeEventListener('pointerdown', handlePointerDown)
  canvas.value?.removeEventListener('pointermove', handlePointerMove)
  canvas.value?.removeEventListener('pointerup', handlePointerUp)
  canvas.value?.removeEventListener('pointerleave', endStroke)
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
