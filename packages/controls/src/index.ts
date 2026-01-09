// Public API - Barrel export pattern
export type {
  ControlAction,
  ControlMapping,
  ControlsOptions,
  ControlsExtras,
  ControlsCurrents,
  ControlsLogs,
  ControlHandlers,
  ControlEvent,
} from './types';

export type {
  FauxPadController,
  FauxPadPosition,
  FauxPadOptions,
} from './fauxpad';

export { DEFAULT_BUTTON_MAP } from './constants';
export { createControls, isMobile } from './core';
export { createFauxPadController } from './fauxpad';
export type { FauxPadOptions as FauxPadControllerOptions } from './fauxpad';
