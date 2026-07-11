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
import type { MarbleMap, BuiltTrack, TrackPieceType } from './types'
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

/**
 * Editor state and scene lifecycle for the marble track editor: holds the
 * current map, applies edit operations, rebuilds the 3D track on change,
 * autosaves to localStorage and supports piece selection and ghost previews.
 */
export const useMarbleEditor = (deps: UseMarbleEditorDeps) => {
  const currentMap = ref<MarbleMap>(loadCurrentMap() ?? SAMPLE_MAPS[0])
  const selectedPieceId = ref<string | null>(null)
  const savedMaps = ref<MarbleMap[]>(listSavedMaps())

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

  const applySelectionHighlight = (): void => {
    state.builtTrack?.models.forEach((model) => {
      const isSelected =
        selectedPieceId.value !== null && model.userData.pieceId === selectedPieceId.value
      setModelEmissive(model, isSelected ? SELECTION_EMISSIVE : 0x000000)
    })
  }

  const rebuildTrack = (): void => {
    if (!state.context) return
    disposeGhost(state)
    state.builtTrack?.dispose()
    state.builtTrack = buildTrack(state.context.scene, state.context.world, currentMap.value)
    applySelectionHighlight()
  }

  const commitMap = (map: MarbleMap, notify = true): void => {
    currentMap.value = map
    saveCurrentMap(map)
    rebuildTrack()
    if (notify) deps.onMapChange?.(map)
  }

  const insertionIndex = (): number => {
    const pieces = currentMap.value.pieces
    const selectedIndex = pieces.findIndex((piece) => piece.id === selectedPieceId.value)
    if (selectedIndex >= 0) return selectedIndex + 1
    const finishIndex = pieces.findIndex((piece) => piece.type === 'finish')
    return finishIndex >= 0 ? finishIndex : pieces.length
  }

  const addPiece = (type: TrackPieceType): void => {
    const next =
      selectedPieceId.value !== null
        ? insertPiece(currentMap.value, insertionIndex(), type)
        : appendPiece(currentMap.value, type)
    commitMap(next)
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
    applySelectionHighlight()
  }

  const previewPiece = (type: TrackPieceType | null): void => {
    disposeGhost(state)
    if (!type || !state.context) return
    const transforms = computeChainTransforms(currentMap.value.pieces)
    const transform = transforms[insertionIndex()] ??
      transforms[transforms.length - 1] ?? { position: [0, 0, 0], yaw: 0 }
    state.ghostGroup = buildPieceGhost(state.context.scene, type, transform)
  }

  const loadMap = (map: MarbleMap, notify = true): void => {
    selectedPieceId.value = null
    commitMap({ ...map, updatedAt: Date.now() }, notify)
  }

  const setMapFromRemote = (map: MarbleMap): void => {
    if (map.updatedAt <= currentMap.value.updatedAt) return
    selectedPieceId.value = null
    commitMap(map, false)
  }

  const startNewMap = (): void => loadMap(createEmptyMap('New track'))

  const saveMapAsName = (name: string): void => {
    savedMaps.value = saveMapAs(currentMap.value, name)
    currentMap.value = { ...currentMap.value, name }
  }

  const deleteMapByName = (name: string): void => {
    savedMaps.value = deleteSavedMap(name)
  }

  const picker = useSceneElementPicker({
    canvas: deps.canvas,
    getCamera: () => state.camera,
    getObjects: () => state.builtTrack?.models ?? [],
    matchObject: (object) =>
      typeof object.userData.pieceId === 'string' ? object.userData.pieceId : null,
    isEnabled: () => state.context !== null,
    onPick: (pieceId) => selectPiece(selectedPieceId.value === pieceId ? null : pieceId)
  })

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
