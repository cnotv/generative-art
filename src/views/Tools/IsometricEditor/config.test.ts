import { describe, it, expect } from 'vitest'
import type { ControlOption, ControlSchema } from '@/stores/viewConfig'
import {
  CITY_MODELS,
  ERASE_MODEL,
  cameraSchema,
  configControls,
  defaultConfig,
  GROUND_SIZE
} from './config'

const modelControl = configControls.model as ControlSchema
const modelOptions = modelControl.options as ControlOption[]
const gridControls = configControls.grid as Record<string, ControlSchema>

describe('config controls', () => {
  it('never lets a model collide with the eraser', () => {
    expect(CITY_MODELS.some((model) => model.value === ERASE_MODEL)).toBe(false)
  })

  it('lists every model plus the eraser', () => {
    expect(modelOptions.map((option) => option.value)).toEqual([
      ...CITY_MODELS.map((model) => model.value),
      ERASE_MODEL
    ])
  })

  it('gives every model a swatch', () => {
    const swatches = modelOptions.filter((option) => option.value !== ERASE_MODEL)
    swatches.forEach((option) => expect(option.color).toMatch(/^#[\da-f]{6}$/))
  })

  it('exposes a clear action the view can answer', () => {
    expect((configControls.clearAll as ControlSchema).callback).toBe('clearAll')
  })

  it('starts on a model rather than the eraser', () => {
    expect(CITY_MODELS.some((model) => model.value === defaultConfig.model)).toBe(true)
  })

  it('keeps the default cell size inside its control range', () => {
    expect(defaultConfig.grid.cellSize).toBeGreaterThanOrEqual(gridControls.cellSize.min as number)
    expect(defaultConfig.grid.cellSize).toBeLessThanOrEqual(gridControls.cellSize.max as number)
  })

  it('never offers a cell wider than the board it divides', () => {
    expect(gridControls.cellSize.max).toBeLessThan(GROUND_SIZE)
  })
})

describe('camera schema', () => {
  it('drops field of view, which an orthographic camera has none of', () => {
    expect(Object.keys(cameraSchema)).not.toContain('fov')
  })

  it.each(['position', 'rotation', 'near', 'far', 'orbitTarget'])(
    'keeps the "%s" control so the Camera row is never empty',
    (key) => {
      expect(Object.keys(cameraSchema)).toContain(key)
    }
  )
})
