import { ref, computed, onUnmounted, type Ref } from 'vue'
import * as THREE from 'three'
import { getTools } from '@webgamekit/threejs'
import { createTimelineManager } from '@webgamekit/animation'
import type { ComplexModel } from '@webgamekit/animation'
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { useSceneElementPicker } from '@/composables/useSceneElementPicker'
import { buildTrack } from './trackBuilder'
import { buildPieceGhost } from './pieceGeometry'
import { computeChainTransforms } from './chainTransforms'
import { appendPiece, insertPiece, removePiece, recolorPiece, createEmptyMap } from './editorOps'
import {
  saveCurrentMap,
  loadCurrentMap,
  listSavedMaps,
  saveMapAs,
  deleteSavedMap
} from './mapStorage'
import { SAMPLE_MAPS } from './sampleMaps'
import type { MarbleMap, BuiltTrack, TrackPieceType, PieceTransform } from './types'
import {
  SKY_COLOR,
  FOG_DENSITY,
  EDITOR_CAMERA_POSITION,
  EDITOR_ORBIT_TARGET,
  SELECTION_EMISSIVE,
  LIGHT_AMBIENT_INTENSITY,
  LIGHT_DIRECTIONAL_INTENSITY,
  LIGHT_DIRECTIONAL_POSITION
} from './config'

type UnwrapPromise<T> = T extends Promise<infer U> ? U : T
type GetToolsResult = UnwrapPromise<ReturnType<typeof getTools>>

type EditorSceneContext = {
  scene: THREE.Scene
  world: NonNullable<GetToolsResult['world']>
}

type EditorSceneState = {
  context: EditorSceneContext | null
  camera: THREE.Camera | null
  builtTrack: BuiltTrack | null
  ghostGroup: THREE.Group | null
  cleanupTools: (() => void) | null
}

export type UseMarbleEditorDeps = {
  canvas: Ref<HTMLCanvasElement | null>
  onMapChange?: (map: MarbleMap) => void
}

const HISTORY_LIMIT = 50

type MapHistory = {
  record: (current: MarbleMap) => void
  undo: (current: MarbleMap) => MarbleMap | null
  redo: (current: MarbleMap) => MarbleMap | null
}

const createMapHistory = (canUndo: Ref<boolean>, canRedo: Ref<boolean>): MapHistory => {
  let past: MarbleMap[] = []
  let future: MarbleMap[] = []
  const sync = (): void => {
    canUndo.value = past.length > 0
    canRedo.value = future.length > 0
  }
  return {
    record: (current) => {
      past = [...past.slice(-(HISTORY_LIMIT - 1)), current]
      future = []
      sync()
    },
    undo: (current) => {
      const previous = past[past.length - 1] ?? null
      if (!previous) return null
      past = past.slice(0, -1)
      future = [current, ...future]
      sync()
      return previous
    },
    redo: (current) => {
      const [next, ...rest] = future
      if (!next) return null
      past = [...past, current]
      future = rest
      sync()
      return next
    }
  }
}

const setModelEmissive = (model: ComplexModel, emissive: number): void => {
  const mesh = model as unknown as THREE.Mesh
  const material = mesh.material as THREE.MeshPhysicalMaterial
  if (material?.emissive) material.emissive.setHex(emissive)
}

const disposeGhost = (state: EditorSceneState): void => {
  if (!state.ghostGroup || !state.context) return
  state.context.scene.remove(state.ghostGroup)
  state.ghostGroup.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.geometry.dispose()
    if (mesh.material instanceof THREE.Material) mesh.material.dispose()
  })
  state.ghostGroup = null
}

const EDITOR_SETUP_CONFIG = {
  camera: { position: EDITOR_CAMERA_POSITION },
  ground: false as const,
  sky: false as const,
  lights: {
    ambient: { intensity: LIGHT_AMBIENT_INTENSITY },
    directional: {
      intensity: LIGHT_DIRECTIONAL_INTENSITY,
      position: LIGHT_DIRECTIONAL_POSITION
    }
  }
}

const applyEditorAtmosphere = (scene: THREE.Scene, orbit: OrbitControls | null): void => {
  scene.fog = new THREE.FogExp2(SKY_COLOR, FOG_DENSITY)
  scene.background = new THREE.Color(SKY_COLOR)
  if (orbit) {
    orbit.target.set(...EDITOR_ORBIT_TARGET)
    orbit.update()
  }
}

const initEditorScene = async (
  state: EditorSceneState,
  canvas: HTMLCanvasElement,
  onSceneReady: () => void
): Promise<void> => {
  const tools = await getTools({ canvas })
  state.cleanupTools = tools.cleanup
  await tools.setup({
    config: EDITOR_SETUP_CONFIG,
    defineSetup: ({ orbit }) => {
      if (!tools.world) return
      state.context = { scene: tools.scene, world: tools.world }
      state.camera = tools.camera
      applyEditorAtmosphere(tools.scene, orbit)
      onSceneReady()
      tools.animate({ timeline: createTimelineManager() })
    }
  })
}

const destroyEditorScene = (state: EditorSceneState): void => {
  disposeGhost(state)
  state.builtTrack?.dispose()
  state.builtTrack = null
  state.context = null
  state.camera = null
  if (state.cleanupTools) {
    state.cleanupTools()
    state.cleanupTools = null
  }
}

const createPiecePicker = (
  canvas: Ref<HTMLCanvasElement | null>,
  state: EditorSceneState,
  onPick: (pieceId: string) => void
) =>
  useSceneElementPicker({
    canvas,
    getCamera: () => state.camera,
    getObjects: () => state.builtTrack?.models ?? [],
    matchObject: (object) =>
      typeof object.userData.pieceId === 'string' ? object.userData.pieceId : null,
    isEnabled: () => state.context !== null,
    onPick
  })

const applyHighlight = (state: EditorSceneState, selectedPieceId: string | null): void => {
  state.builtTrack?.models.forEach((model) => {
    const isSelected = selectedPieceId !== null && model.userData.pieceId === selectedPieceId
    setModelEmissive(model, isSelected ? SELECTION_EMISSIVE : 0x000000)
  })
}

const insertionIndexFor = (map: MarbleMap, selectedPieceId: string | null): number => {
  const selectedIndex = map.pieces.findIndex((piece) => piece.id === selectedPieceId)
  if (selectedIndex >= 0) return selectedIndex + 1
  const finishIndex = map.pieces.findIndex((piece) => piece.type === 'finish')
  return finishIndex >= 0 ? finishIndex : map.pieces.length
}

const previewTransformFor = (map: MarbleMap, selectedPieceId: string | null): PieceTransform => {
  const transforms = computeChainTransforms(map.pieces)
  return (
    transforms[insertionIndexFor(map, selectedPieceId)] ??
    transforms[transforms.length - 1] ?? { position: [0, 0, 0], yaw: 0 }
  )
}

/**
 * Editor state and scene lifecycle for the marble track editor: holds the
 * current map, applies edit operations, rebuilds the 3D track on change,
 * autosaves to localStorage and supports piece selection and ghost previews.
 */
export const useMarbleEditor = (deps: UseMarbleEditorDeps) => {
  const currentMap = ref<MarbleMap>(loadCurrentMap() ?? SAMPLE_MAPS[0])
  const selectedPieceId = ref<string | null>(null)
  const savedMaps = ref<MarbleMap[]>(listSavedMaps())
  const canUndo = ref(false)
  const canRedo = ref(false)
  const history = createMapHistory(canUndo, canRedo)

  const selectedPiece = computed(
    () => currentMap.value.pieces.find((piece) => piece.id === selectedPieceId.value) ?? null
  )

  const state: EditorSceneState = {
    context: null,
    camera: null,
    builtTrack: null,
    ghostGroup: null,
    cleanupTools: null
  }

  const rebuildTrack = (): void => {
    if (!state.context) return
    disposeGhost(state)
    state.builtTrack?.dispose()
    state.builtTrack = buildTrack(state.context.scene, state.context.world, currentMap.value)
    applyHighlight(state, selectedPieceId.value)
  }

  const commitMap = (map: MarbleMap, notify = true, record = true): void => {
    if (record) history.record(currentMap.value)
    currentMap.value = map
    saveCurrentMap(map)
    rebuildTrack()
    if (notify) deps.onMapChange?.(map)
  }

  const applyHistoryStep = (map: MarbleMap | null): void => {
    if (!map) return
    selectedPieceId.value = null
    commitMap(map, true, false)
  }

  const undo = (): void => applyHistoryStep(history.undo(currentMap.value))
  const redo = (): void => applyHistoryStep(history.redo(currentMap.value))

  const addPiece = (type: TrackPieceType): void => {
    const previousIds = new Set(currentMap.value.pieces.map((piece) => piece.id))
    const next =
      selectedPieceId.value !== null
        ? insertPiece(
            currentMap.value,
            insertionIndexFor(currentMap.value, selectedPieceId.value),
            type
          )
        : appendPiece(currentMap.value, type)
    commitMap(next)
    const added = next.pieces.find((piece) => !previousIds.has(piece.id))
    if (added) selectPiece(added.id)
  }

  const removeSelectedPiece = (): void => {
    if (!selectedPieceId.value) return
    const next = removePiece(currentMap.value, selectedPieceId.value)
    selectedPieceId.value = null
    commitMap(next)
  }

  const recolorSelectedPiece = (color: number): void => {
    if (!selectedPieceId.value) return
    commitMap(recolorPiece(currentMap.value, selectedPieceId.value, color))
  }

  const selectPiece = (pieceId: string | null): void => {
    selectedPieceId.value = pieceId
    applyHighlight(state, pieceId)
  }

  const previewPiece = (type: TrackPieceType | null): void => {
    disposeGhost(state)
    if (!type || !state.context) return
    const transform = previewTransformFor(currentMap.value, selectedPieceId.value)
    state.ghostGroup = buildPieceGhost(state.context.scene, type, transform)
  }

  const loadMap = (map: MarbleMap, notify = true): void => {
    selectedPieceId.value = null
    commitMap({ ...map, updatedAt: Date.now() }, notify)
  }

  const setMapFromRemote = (map: MarbleMap): void => {
    if (map.updatedAt <= currentMap.value.updatedAt) return
    selectedPieceId.value = null
    commitMap(map, false, false)
  }

  const startNewMap = (): void => loadMap(createEmptyMap('New track'))

  const saveMapAsName = (name: string): void => {
    savedMaps.value = saveMapAs(currentMap.value, name)
    currentMap.value = { ...currentMap.value, name }
  }

  const deleteMapByName = (name: string): void => {
    savedMaps.value = deleteSavedMap(name)
  }

  const picker = createPiecePicker(deps.canvas, state, (pieceId) =>
    selectPiece(selectedPieceId.value === pieceId ? null : pieceId)
  )

  const init = async (): Promise<void> => {
    if (!deps.canvas.value) return
    await initEditorScene(state, deps.canvas.value, rebuildTrack)
    picker.mount()
  }

  const destroy = (): void => {
    picker.unmount()
    destroyEditorScene(state)
  }

  onUnmounted(destroy)

  return {
    currentMap,
    selectedPiece,
    selectedPieceId,
    savedMaps,
    canUndo,
    canRedo,
    undo,
    redo,
    addPiece,
    removeSelectedPiece,
    recolorSelectedPiece,
    selectPiece,
    previewPiece,
    loadMap,
    setMapFromRemote,
    startNewMap,
    saveMapAsName,
    deleteMapByName,
    init,
    destroy
  }
}
