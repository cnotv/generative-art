export type ControlAction = string;
export type ControlEvent = 'touchstart' | 'touchend' | 'mousedown' | 'mouseup';

export interface ControlMapping {
  keyboard?: Record<string, ControlAction>;
  gamepad?: Record<string, ControlAction>; // Supports both buttons (cross, dpad-up) and axes (axis0-left, axis1-up)
  touch?: Record<string, ControlAction>;
  'faux-pad'?: Record<string, ControlAction>; // Virtual faux-pad: up, down, left, right
}

export interface ControlsOptions {
  mapping: ControlMapping;
  onAction?: (action: ControlAction, trigger: string, device: string) => void;
  onRelease?: (action: ControlAction, trigger: string, device: string) => void;
  onInput?: (action: ControlAction, trigger: string, device: string) => void;
  keyboard?: boolean;
  gamepad?: boolean;
  touch?: boolean;
  mouse?: boolean;
  touchTarget?: HTMLElement | null;
  mouseTarget?: HTMLElement | null;
  buttonMap?: string[]; // Optional: custom button names by index
  axisThreshold?: number; // Threshold for axis activation (default: 0.5)
}

export type ControlsCurrents = Record<string, { 
  action: string; 
  trigger: string; 
  device: string;
  triggers: Set<string>; // Track all active triggers for this action
}>;
export type ControlsLogs = Array<{ action: string; trigger: string; device: string; timestamp: number; type: string }>;

export type ControlsExtras = {
  destroyControls: () => void;
  remapControlsOptions: (newOptions: ControlsOptions) => void;
  currentActions: ControlsCurrents;
  logs: ControlsLogs;
  buttonMap: string[];
}

export interface ControlHandlers {
  onAction: (action: ControlAction, trigger: string, device: string) => void;
  onRelease: (action: ControlAction, trigger: string, device: string) => void;
  onInput?: (action: ControlAction, trigger: string, device: string) => void;
}
