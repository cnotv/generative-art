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
  GRID_ELEVATION,
  GRID_LINE_COLOR,
  GROUND_SIZE,
  HIGHLIGHT_COLOR,
  HIGHLIGHT_HEIGHT,
  HIGHLIGHT_OPACITY,
  CITY_MODELS,
  CITY_PRESET,
  cameraSchema,
  configControls,
  defaultConfig,
  sceneSetupConfig
} from './config'
import { buildCityModel } from './models'
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
let orbitReference: { enabled: boolean } | null = null
let pointerDownAt: [number, number] | null = null
let strokeMode: PaintMode | null = null
let strokedCellKey: string | null = null
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

/** Orbit and painting both live on a drag, so only one of them is listening at a time. */
const syncOrbit = (): void => {
  if (orbitReference) setOrbitEnabled(orbitReference, reactiveConfig.value.orbit)
}

const applyConfig = (): void => {
  syncGrid()
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

  const { cellSize } = reactiveConfig.value.grid
  const name = [model.value, cellKey].join('_')
  const group = buildCityModel(sceneReference, worldReference, model, cellSize, name)
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
  const { cellSize } = reactiveConfig.value.grid
  const point = getGroundPoint(event)
  if (!point || !isInsideGrid(point.x, point.z, gridExtent)) return null
  return {
    cellKey: getCellKey(point.x, point.z, cellSize),
    x: snapToCell(point.x, cellSize),
    z: snapToCell(point.z, cellSize)
  }
}

/**
 * What a gesture starting on this cell does, held for the whole stroke.
 *
 * Pressing on a cell that is already filled takes its component away, so the same click both
 * places and removes. The mode is then fixed, or dragging a road across a park would erase the
 * park instead of paving it.
 * @param cellKey The cell the gesture started on
 * @returns Whether the stroke fills cells or empties them
 */
const getStrokeMode = (cellKey: string): PaintMode =>
  reactiveConfig.value.model === ERASE_MODEL || placedModels.has(cellKey) ? 'erasing' : 'placing'

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
  const { cellSize } = reactiveConfig.value.grid
  const point = getGroundPoint(event)
  const onGrid = Boolean(point) && isInsideGrid(point?.x ?? 0, point?.z ?? 0, gridExtent)
  if (cellHighlight) cellHighlight.visible = onGrid
  if (!point || !onGrid) return

  const x = snapToCell(point.x, cellSize)
  const z = snapToCell(point.z, cellSize)
  cellHighlight?.position.set(x, HIGHLIGHT_HEIGHT / 2, z)

  if (!strokeMode) return
  const cellKey = getCellKey(point.x, point.z, cellSize)
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
  reactiveConfig.value.grid.cellSize = CITY_PRESET.cellSize
  syncGrid()

  CITY_PRESET.pieces.forEach((piece) => {
    const model = CITY_MODELS.find((entry) => entry.value === piece.model)
    if (!model) return
    piece.cells.forEach(([cellX, cellZ]) => {
      const x = getCellCentre(cellX, CITY_PRESET.cellSize)
      const z = getCellCentre(cellZ, CITY_PRESET.cellSize)
      placeModel(model, getCellKey(x, z, CITY_PRESET.cellSize), x, z)
    })
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

  const { elements } = await setup({ config: sceneSetupConfig })

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
