import type { ControlDevice } from '@webgamekit/controls'

export interface MapperActionConfig {
  id: string
  label: string
}

export interface MapperDeviceConfig {
  id: ControlDevice
  label: string
}

export const MAPPER_ACTIONS: MapperActionConfig[] = [
  { id: 'move-forward', label: 'Move forward' },
  { id: 'move-back', label: 'Move back' },
  { id: 'move-left', label: 'Move left' },
  { id: 'move-right', label: 'Move right' },
  { id: 'jump', label: 'Jump' }
]

export const MAPPER_DEVICES: MapperDeviceConfig[] = [
  { id: 'keyboard', label: 'Keyboard' },
  { id: 'gamepad', label: 'Gamepad' },
  { id: 'faux-pad', label: 'Faux-pad' }
]

export const FAUX_PAD_DIRECTIONS = ['up', 'down', 'left', 'right'] as const
