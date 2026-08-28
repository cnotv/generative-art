import type { ConfigControlsSchema } from '@/stores/viewConfig'
import { cameraSchema as sceneCameraSchema } from '@/views/Tools/SceneEditor/config'
import {
  BOARD_SIZE_MAX,
  BOARD_SIZE_MIN,
  BOARD_SIZE_STEP,
  CITY_MODELS,
  CITY_PRESET,
  ERASE_MODEL
} from './config'

/** The shared camera controls without field of view, which an orthographic camera has none of. */
export const cameraSchema = {
  position: sceneCameraSchema.position,
  rotation: sceneCameraSchema.rotation,
  near: sceneCameraSchema.near,
  far: sceneCameraSchema.far,
  orbitTarget: sceneCameraSchema.orbitTarget
}

const HEX_RADIX = 16
const HEX_COLOR_DIGITS = 6

const toSwatch = (color: number): string =>
  `#${color.toString(HEX_RADIX).padStart(HEX_COLOR_DIGITS, '0')}`

/**
 * The Config panel, built from the catalogue rather than repeating it.
 *
 * This lives beside `config.ts` rather than in it because a config file holds values and this
 * derives them: add a component to `CITY_MODELS` and its palette button appears here on its own.
 */
export const configControls: ConfigControlsSchema = {
  model: {
    label: 'Model',
    component: 'ButtonSelector',
    // Wrapped rather than stacked: a column of fourteen pushes the rest of the panel off screen.
    direction: 'row',
    options: [
      ...CITY_MODELS.map(({ value, label, swatch }) => ({
        value,
        label,
        color: toSwatch(swatch)
      })),
      { value: ERASE_MODEL, label: 'Erase' }
    ]
  },
  loadPreset: { label: `Load ${CITY_PRESET.name.toLowerCase()}`, callback: 'loadPreset' },
  clearAll: { label: 'Clear all', callback: 'clearAll' },
  orbit: { boolean: false, label: 'Orbit camera' },
  grid: {
    show: { boolean: true, label: 'Show grid' },
    size: {
      label: 'Board size',
      min: BOARD_SIZE_MIN,
      max: BOARD_SIZE_MAX,
      step: BOARD_SIZE_STEP
    }
  }
}
