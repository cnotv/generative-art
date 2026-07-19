import { ref, computed, onUnmounted, type Ref } from 'vue'
import * as THREE from 'three'
import { storeToRefs } from 'pinia'
import { getTools } from '@webgamekit/threejs'
import { createControls, loadMapping } from '@webgamekit/controls'
import type { ControlsExtras, ControlMapping } from '@webgamekit/controls'
import { createTimelineManager } from '@webgamekit/animation'
import { useMarbleEditorStore } from '@/stores/marbleEditor'
import { reportInputSource } from '@/composables/useInputDevice'
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
import { computeTrackBounds, computeRoomLayout, roomLayoutsEqual } from './bedroomLayout'
import { buildBedroom, applyBedroomAtmosphere } from './bedroomEnvironment'
import type {
  MarbleMap,
  BuiltTrack,
  TrackPieceType,
  PieceTransform,
  BedroomEnvironment
} from './types'
import {
  EDITOR_CAMERA_POSITION,
  EDITOR_ORBIT_TARGET,
  SELECTION_EMISSIVE,
  SELECTION_PULSE_MIN,
  SELECTION_PULSE_MAX,
  SELECTION_PULSE_SPEED,
  LIGHT_AMBIENT_INTENSITY,
  LIGHT_DIRECTIONAL_INTENSITY,
  LIGHT_DIRECTIONAL_POSITION,
  EDITOR_MAPPING,
  EDITOR_ACTION_IDS,
  CONTROLS_GAME_ID,
  EDITOR_CAMERA_ROTATE_SPEED,
  EDITOR_CAMERA_PAN_SPEED,
  EDITOR_CAMERA_POLAR_MIN,
  EDITOR_CAMERA_POLAR_MAX
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
  orbit: OrbitControls | null
  builtTrack: BuiltTrack | null
  ghostGroup: THREE.Group | null
  bedroom: BedroomEnvironment | null
  controls: ControlsExtras | null
  pulseTime: number
  cleanupTools: (() => void) | null
}

// Typing in the save-name input must not trigger the Z/Y edit shortcuts.
const isTypingInField = (): boolean => {
  const active = document.activeElement
  return (
    active instanceof HTMLInputElement ||
    active instanceof HTMLTextAreaElement ||
    active instanceof HTMLSelectElement
  )
}

type EditorActionHandlers = {
  undo: () => void
  redo: () => void
  selectPrevious: () => void
  selectNext: () => void
  play: () => void
  save: () => void
  newTrack: () => void
}

// Stored remaps apply only for the actions the edit phase owns, so a race
// binding on the same key can coexist in the shared stored mapping.
const editorMapping = (): ControlMapping => {
  const stored = loadMapping(CONTROLS_GAME_ID)
  const pickEditorBindings = (bindings?: Record<string, string>): Record<string, string> =>
    Object.fromEntries(
      Object.entries(bindings ?? {}).filter(([, action]) => EDITOR_ACTION_IDS.has(action))
    )
  return {
    keyboard: { ...EDITOR_MAPPING.keyboard, ...pickEditorBindings(stored?.keyboard) },
    gamepad: { ...EDITOR_MAPPING.gamepad, ...pickEditorBindings(stored?.gamepad) }
  }
}

const createEditorControls = (handlers: EditorActionHandlers): ControlsExtras =>
  createControls({
    mapping: editorMapping(),
    onAction: (action, _trigger, rawSource) => {
      reportInputSource(String(rawSource ?? 'keyboard'))
      if (isTypingInField()) return
      const actionHandlers: Record<string, () => void> = {
        undo: handlers.undo,
        redo: handlers.redo,
        'select-previous': handlers.selectPrevious,
        'select-next': handlers.selectNext,
        play: handlers.play,
        save: handlers.save,
        'new-track': handlers.newTrack
      }
      actionHandlers[action]?.()
    }
  })

const CAMERA_ORBIT_OFFSET = new THREE.Vector3()
const CAMERA_ORBIT_SPHERICAL = new THREE.Spherical()
const CAMERA_PAN_FORWARD = new THREE.Vector3()
const CAMERA_PAN_RIGHT = new THREE.Vector3()
const CAMERA_UP = new THREE.Vector3(0, 1, 0)

const heldDirection = (
  actions: Record<string, unknown>,
  positive: string,
  negative: string
): number => (positive in actions ? 1 : 0) - (negative in actions ? 1 : 0)

const rotateOrbit = (state: EditorSceneState, azimuth: number, polar: number): void => {
  if (!state.orbit || !state.camera) return
  CAMERA_ORBIT_OFFSET.copy(state.camera.position).sub(state.orbit.target)
  CAMERA_ORBIT_SPHERICAL.setFromVector3(CAMERA_ORBIT_OFFSET)
  CAMERA_ORBIT_SPHERICAL.theta += azimuth
  CAMERA_ORBIT_SPHERICAL.phi = Math.min(
    EDITOR_CAMERA_POLAR_MAX,
    Math.max(EDITOR_CAMERA_POLAR_MIN, CAMERA_ORBIT_SPHERICAL.phi - polar)
  )
  CAMERA_ORBIT_OFFSET.setFromSpherical(CAMERA_ORBIT_SPHERICAL)
  state.camera.position.copy(state.orbit.target).add(CAMERA_ORBIT_OFFSET)
  state.orbit.update()
}

// Ground-plane pan: target and camera glide together along the camera's
// forward/right axes projected onto the floor.
const panOrbit = (state: EditorSceneState, strafe: number, advance: number): void => {
  if (!state.orbit || !state.camera) return
  state.camera.getWorldDirection(CAMERA_PAN_FORWARD)
  CAMERA_PAN_FORWARD.y = 0
  if (CAMERA_PAN_FORWARD.lengthSq() < 1e-6) return
  CAMERA_PAN_FORWARD.normalize()
  CAMERA_PAN_RIGHT.crossVectors(CAMERA_PAN_FORWARD, CAMERA_UP)
  CAMERA_PAN_FORWARD.multiplyScalar(advance)
  CAMERA_PAN_RIGHT.multiplyScalar(strafe)
  state.orbit.target.add(CAMERA_PAN_FORWARD).add(CAMERA_PAN_RIGHT)
  state.camera.position.add(CAMERA_PAN_FORWARD).add(CAMERA_PAN_RIGHT)
  state.orbit.update()
}

// Right stick alone rotates around the orbit target; holding L2 turns the
// same stick into a ground-plane pan.
const rotateEditorCamera = (state: EditorSceneState, deltaSeconds: number): void => {
  if (!state.controls) return
  const actions = state.controls.currentActions
  const horizontal = heldDirection(actions, 'camera-left', 'camera-right')
  const vertical = heldDirection(actions, 'camera-up', 'camera-down')
  if (horizontal === 0 && vertical === 0) return
  if ('camera-pan' in actions) {
    const step = EDITOR_CAMERA_PAN_SPEED * deltaSeconds
    panOrbit(state, -horizontal * step, vertical * step)
    return
  }
  const step = EDITOR_CAMERA_ROTATE_SPEED * deltaSeconds
  rotateOrbit(state, horizontal * step, vertical * step)
}

// The selected piece breathes: its emissive intensity pulses so the current
// track part reads clearly at any camera distance.
const pulseSelection = (
  state: EditorSceneState,
  selectedPieceId: string | null,
  deltaSeconds: number
): void => {
  state.pulseTime += deltaSeconds
  const wave = 0.5 + 0.5 * Math.sin(state.pulseTime * SELECTION_PULSE_SPEED)
  const intensity = SELECTION_PULSE_MIN + (SELECTION_PULSE_MAX - SELECTION_PULSE_MIN) * wave
  state.builtTrack?.models.forEach((model) => {
    const material = model.material as THREE.MeshStandardMaterial
    if (!material?.emissive) return
    material.emissiveIntensity =
      selectedPieceId !== null && model.userData.pieceId === selectedPieceId ? intensity : 1
  })
}

export type UseMarbleEditorDeps = {
  canvas: Ref<HTMLCanvasElement | null>
  onMapChange?: (map: MarbleMap) => void
  onPlay?: () => void
  onSave?: () => void
  onNewTrack?: () => void
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

const setModelEmissive = (mesh: THREE.Mesh, emissive: number): void => {
  const material = mesh.material as THREE.MeshStandardMaterial
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
  applyBedroomAtmosphere(scene)
  if (orbit) {
    orbit.target.set(...EDITOR_ORBIT_TARGET)
    orbit.update()
  }
}

const syncBedroom = (state: EditorSceneState): void => {
  if (!state.context || !state.builtTrack) return
  const layout = computeRoomLayout(computeTrackBounds(state.builtTrack.transforms))
  if (state.bedroom && roomLayoutsEqual(state.bedroom.layout, layout)) return
  state.bedroom?.dispose()
  state.bedroom = buildBedroom(state.context.scene, layout)
}

const initEditorScene = async (
  state: EditorSceneState,
  canvas: HTMLCanvasElement,
  onSceneReady: () => void,
  getSelectedPieceId: () => string | null
): Promise<void> => {
  const tools = await getTools({ canvas })
  state.cleanupTools = tools.cleanup
  await tools.setup({
    config: EDITOR_SETUP_CONFIG,
    defineSetup: ({ orbit }) => {
      if (!tools.world) return
      state.context = { scene: tools.scene, world: tools.world }
      state.camera = tools.camera
      state.orbit = orbit
      applyEditorAtmosphere(tools.scene, orbit)
      onSceneReady()
      const timeline = createTimelineManager()
      timeline.addAction({
        name: 'editor-camera-orbit',
        category: 'camera',
        start: 0,
        action: () => rotateEditorCamera(state, tools.getDelta())
      })
      timeline.addAction({
        name: 'selection-pulse',
        category: 'ui',
        start: 0,
        action: () => pulseSelection(state, getSelectedPieceId(), tools.getDelta())
      })
      tools.animate({ timeline })
    }
  })
}

const destroyEditorScene = (state: EditorSceneState): void => {
  disposeGhost(state)
  state.bedroom?.dispose()
  state.bedroom = null
  state.builtTrack?.dispose()
  state.builtTrack = null
  state.context = null
  state.camera = null
  state.orbit = null
  state.pulseTime = 0
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

const nextSelectedPieceId = (
  pieces: MarbleMap['pieces'],
  selectedId: string | null,
  direction: 1 | -1
): string | null => {
  if (!pieces.length) return null
  const currentIndex = pieces.findIndex((piece) => piece.id === selectedId)
  const fallbackIndex = direction === 1 ? 0 : pieces.length - 1
  const nextIndex =
    currentIndex === -1 ? fallbackIndex : (currentIndex + direction + pieces.length) % pieces.length
  return pieces[nextIndex].id
}

const addPieceToMap = (
  map: MarbleMap,
  selectedId: string | null,
  type: TrackPieceType
): { next: MarbleMap; addedId: string | null } => {
  const previousIds = new Set(map.pieces.map((piece) => piece.id))
  const next =
    selectedId !== null
      ? insertPiece(map, insertionIndexFor(map, selectedId), type)
      : appendPiece(map, type)
  return { next, addedId: next.pieces.find((piece) => !previousIds.has(piece.id))?.id ?? null }
}

const createHistoryActions = (
  history: MapHistory,
  currentMap: Ref<MarbleMap>,
  selectedPieceId: Ref<string | null>,
  commitMap: (map: MarbleMap, notify?: boolean, record?: boolean) => void
): { undo: () => void; redo: () => void } => {
  const applyStep = (map: MarbleMap | null): void => {
    if (!map) return
    selectedPieceId.value = null
    commitMap(map, true, false)
  }
  return {
    undo: () => applyStep(history.undo(currentMap.value)),
    redo: () => applyStep(history.redo(currentMap.value))
  }
}

type MapCommitDeps = {
  state: EditorSceneState
  currentMap: Ref<MarbleMap>
  selectedPieceId: Ref<string | null>
  history: MapHistory
  onMapChange?: (map: MarbleMap) => void
}

const createMapCommitter = ({
  state,
  currentMap,
  selectedPieceId,
  history,
  onMapChange
}: MapCommitDeps) => {
  const rebuildTrack = (): void => {
    if (!state.context) return
    disposeGhost(state)
    state.builtTrack?.dispose()
    state.builtTrack = buildTrack(state.context.scene, state.context.world, currentMap.value)
    applyHighlight(state, selectedPieceId.value)
    syncBedroom(state)
  }

  const commitMap = (map: MarbleMap, notify = true, record = true): void => {
    if (record) history.record(currentMap.value)
    currentMap.value = map
    saveCurrentMap(map)
    rebuildTrack()
    if (notify) onMapChange?.(map)
  }

  return { rebuildTrack, commitMap }
}

/**
 * Editor state and scene lifecycle for the marble track editor: holds the
 * current map, applies edit operations, rebuilds the 3D track on change,
 * autosaves to localStorage and supports piece selection and ghost previews.
 */
export const useMarbleEditor = (deps: UseMarbleEditorDeps) => {
  const currentMap = ref<MarbleMap>(loadCurrentMap() ?? SAMPLE_MAPS[0])
  const { selectedPieceId } = storeToRefs(useMarbleEditorStore())
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
    orbit: null,
    builtTrack: null,
    ghostGroup: null,
    bedroom: null,
    controls: null,
    pulseTime: 0,
    cleanupTools: null
  }

  const { rebuildTrack, commitMap } = createMapCommitter({
    state,
    currentMap,
    selectedPieceId,
    history,
    onMapChange: deps.onMapChange
  })

  const { undo, redo } = createHistoryActions(history, currentMap, selectedPieceId, commitMap)

  const addPiece = (type: TrackPieceType): void => {
    const { next, addedId } = addPieceToMap(currentMap.value, selectedPieceId.value, type)
    commitMap(next)
    if (addedId) selectPiece(addedId)
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

  const selectStartPiece = (): void => selectPiece(currentMap.value.pieces[0]?.id ?? null)

  const loadMap = (map: MarbleMap, notify = true): void => {
    commitMap({ ...map, updatedAt: Date.now() }, notify)
    selectStartPiece()
  }

  const setMapFromRemote = (map: MarbleMap): void => {
    if (map.updatedAt <= currentMap.value.updatedAt) return
    selectedPieceId.value = null
    commitMap(map, false, false)
  }

  const startNewMap = (name: string): void => loadMap(createEmptyMap(name.trim() || 'New track'))

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

  const cycleSelection = (direction: 1 | -1): void => {
    const nextId = nextSelectedPieceId(currentMap.value.pieces, selectedPieceId.value, direction)
    if (nextId) selectPiece(nextId)
  }

  const init = async (): Promise<void> => {
    if (!deps.canvas.value) return
    state.controls = createEditorControls({
      undo,
      redo,
      selectPrevious: () => cycleSelection(-1),
      selectNext: () => cycleSelection(1),
      play: () => deps.onPlay?.(),
      save: () => deps.onSave?.(),
      newTrack: () => deps.onNewTrack?.()
    })
    await initEditorScene(state, deps.canvas.value, rebuildTrack, () => selectedPieceId.value)
    selectStartPiece()
    picker.mount()
  }

  const destroy = (): void => {
    state.controls?.destroyControls()
    state.controls = null
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
