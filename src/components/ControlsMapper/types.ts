import type { ControlDevice, ControlMapping } from '@webgamekit/controls'

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

export interface ControlsMapperGameConfig {
  gameId: string
  actions: MapperActionConfig[]
  defaultMapping?: ControlMapping
}
