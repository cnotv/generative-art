export { drawingStroke, drawingDot, drawingFill, drawingClear, drawingRestore } from './drawing'
export type { DrawingTool, DrawingOptions, DrawingPoint, StrokeEvent, FillEvent } from './drawing'

/**
 * Undo is the same stack every editor in this toolkit uses, re-exported so a canvas editor is
 * usable on its own: snapshot with `textureToDataUrl` or the canvas's own `toDataURL`, and put a
 * snapshot back with `drawingRestore`.
 */
export {
  historyCreate,
  historyState,
  historyPush,
  historyUndo,
  historyRedo,
  historyGoTo,
  historyCanUndo,
  historyCanRedo,
  historyLog
} from '@webgamekit/history'
export type { HistoryEntry, HistoryLogEntry, HistoryStack, HistoryStep } from '@webgamekit/history'

export {
  storageSave,
  storageLoad,
  storageDelete,
  storageList,
  storageSaveLocal,
  storageLoadLocal,
  storageDeleteLocal,
  storageListLocal,
  storageSaveIdb,
  storageLoadIdb,
  storageDeleteIdb,
  storageListIdb
} from './storage'
export type { StorageBackend, StorageSlot } from './storage'

export {
  textureLoadImage,
  textureResizeToMaxWidth,
  textureBuildCombined,
  textureToDataUrl
} from './texture'
