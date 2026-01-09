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

export { DEFAULT_BUTTON_MAP } from './constants';
export { createControls, isMobile } from './core';
