import { describe, it, expect } from 'vitest'
import type { ControlOption, ControlSchema } from '@/stores/viewConfig'
import {
  CITY_MODELS,
  ERASE_MODEL,
  cameraSchema,
  configControls,
  defaultConfig,
  BOARD_SIZE_MAX,
  BOARD_SIZE_STEP,
  CELL_SIZE
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

  it('keeps the default board size inside its control range', () => {
    expect(defaultConfig.grid.size).toBeGreaterThanOrEqual(gridControls.size.min as number)
    expect(defaultConfig.grid.size).toBeLessThanOrEqual(gridControls.size.max as number)
  })

  // Every reachable board size has to be a whole even number of cells, or the drawn lines fall
  // half a cell out of step with the cells the snapping computes from the origin.
  it.each(
    Array.from(
      { length: (BOARD_SIZE_MAX - (gridControls.size.min as number)) / BOARD_SIZE_STEP + 1 },
      (_, step) => (gridControls.size.min as number) + step * BOARD_SIZE_STEP
    )
  )('board size %i is an even number of cells', (boardSize) => {
    expect(boardSize % (CELL_SIZE * 2)).toBe(0)
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
