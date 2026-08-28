import { describe, it, expect } from 'vitest'
import { CITY_MODELS } from './config'
import type { CityModel } from './types'

const parts = CITY_MODELS.flatMap((model) => model.parts.map((part) => ({ model, part })))

describe('city model catalogue', () => {
  it('offers more than one component', () => {
    expect(CITY_MODELS.length).toBeGreaterThan(1)
  })

  it('gives every model a unique value', () => {
    const values = CITY_MODELS.map((model) => model.value)
    expect(new Set(values).size).toBe(values.length)
  })

  it.each(CITY_MODELS)('"$value" is built from at least one part', (model: CityModel) => {
    expect(model.parts.length).toBeGreaterThan(0)
  })

  it.each(CITY_MODELS)('"$value" takes its swatch from one of its parts', (model: CityModel) => {
    expect(model.parts.map((part) => part.color)).toContain(model.swatch)
  })
})

describe('city model parts', () => {
  it.each(parts)('$model.value part is a shape the builder can make', ({ part }) => {
    expect(['cube', 'ball', 'cylinder']).toContain(part.shape)
  })

  it.each(parts)('$model.value part has a size in every dimension', ({ part }) => {
    expect(part.size.every((cells) => cells > 0)).toBe(true)
  })

  it.each(parts)('$model.value part never sinks below the ground', ({ part }) => {
    expect(part.offset[1]).toBeGreaterThanOrEqual(0)
  })

  // A part reaching past its cell would intersect whatever is placed next door, and a run of
  // roads or fences would stop reading as one continuous thing.
  it.each(parts)('$model.value part stays inside its own cell', ({ part }) => {
    const halfCell = 0.5
    expect(Math.abs(part.offset[0]) + part.size[0] / 2).toBeLessThanOrEqual(halfCell)
    expect(Math.abs(part.offset[2]) + part.size[2] / 2).toBeLessThanOrEqual(halfCell)
  })
})
