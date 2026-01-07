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

export interface ControlHandlers {
  onAction: (action: ControlAction, trigger: string, device: string) => void;
  onRelease: (action: ControlAction, trigger: string, device: string) => void;
  onInput?: (action: ControlAction, trigger: string, device: string) => void;
}
