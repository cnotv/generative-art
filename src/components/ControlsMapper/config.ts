import type { ControlDevice } from '@webgamekit/controls'

export interface MapperActionConfig {
  id: string
  label: string
  // Directional actions bind to a faux-pad direction; others bind to a button.
  directional?: boolean
}

export interface MapperDeviceConfig {
  id: ControlDevice
  label: string
}

export const MAPPER_ACTIONS: MapperActionConfig[] = [
  { id: 'move-forward', label: 'Move forward', directional: true },
  { id: 'move-back', label: 'Move back', directional: true },
  { id: 'move-left', label: 'Move left', directional: true },
  { id: 'move-right', label: 'Move right', directional: true },
  { id: 'jump', label: 'Jump' }
]

export const MAPPER_DEVICES: MapperDeviceConfig[] = [
  { id: 'keyboard', label: 'Keyboard' },
  { id: 'gamepad', label: 'Gamepad' },
  { id: 'faux-pad', label: 'Faux-pad' }
]

export const FAUX_PAD_DIRECTIONS = ['up', 'down', 'left', 'right'] as const
