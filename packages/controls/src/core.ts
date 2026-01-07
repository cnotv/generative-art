export type ControlAction = string;
export type ControlEvent = 'down' | 'up';

export interface ControlMapping {
  keyboard?: Record<string, ControlAction>;
  gamepad?: Record<string, ControlAction>;
  touch?: Record<string, ControlAction>;
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
}

export type ControlsCurrents = Record<string, { action: string; trigger: string; device: string }>;
export type ControlsLogs = Array<{ action: string; trigger: string; device: string; timestamp: number; type: string }>;

export type ControlsExtras = {
  destroyControls: () => void;
  remapControlsOptions: (newOptions: ControlsOptions) => void;
  currentActions: ControlsCurrents;
  logs: ControlsLogs;
  buttonMap: string[];
}

// Default button names for DualShock/Xbox (can be overridden)
export const DEFAULT_BUTTON_MAP = [
  'cross',    // 0
  'circle',   // 1
  'square',   // 2
  'triangle', // 3
  'l1',       // 4
  'r1',       // 5
  'l2',       // 6
  'r2',       // 7
  'share',    // 8
  'options',  // 9
  'l3',       // 10
  'r3',       // 11
  'dpad-up',  // 12
  'dpad-down',// 13
  'dpad-left',// 14
  'dpad-right',// 15
  'ps',       // 16
  'touchpad', // 17
];

export interface ControlHandlers {
  onAction: (action: ControlAction, trigger: string, device: string) => void;
  onRelease: (action: ControlAction, trigger: string, device: string) => void;
  onInput?: (action: ControlAction, trigger: string, device: string) => void;
}
