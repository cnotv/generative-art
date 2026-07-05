// Public API - Barrel export pattern
export type {
  ControlAction,
  ControlDevice,
  ControlMapping,
  ControlsOptions,
  ControlsExtras,
  ControlsCurrents,
  ControlsLogs,
  ControlHandlers,
  ControlEvent,
  ControlSkin,
  ControlSkinId,
  ControlPreset
} from './types'

export type { FauxPadController, FauxPadPosition, FauxPadOptions } from './fauxpad'

export { DEFAULT_BUTTON_MAP } from './constants'
export { createControls, isMobile } from './core'
export { createFauxPadController } from './fauxpad'
export type { FauxPadOptions as FauxPadControllerOptions } from './fauxpad'

export { assignBinding, removeBinding, createDefaultMapping } from './mapping'
export { CONTROL_SKINS, getDefaultSkinId } from './skins'
export {
  serializePreset,
  parsePreset,
  savePresets,
  loadPresets,
  saveMapping,
  loadMapping,
  PRESETS_STORAGE_KEY
} from './presets'
