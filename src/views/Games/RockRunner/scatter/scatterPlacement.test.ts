import { describe, it, expect } from 'vitest'
import {
  scatterInstanceCount,
  applyVariation,
  lateralOffset,
  placeScatterInstances,
  SCATTER_FREQUENCY_UNIT
} from './scatterPlacement'
import { createTrackPath } from '../trackPath'
import { TRACK_HALF_WIDTH } from '../config'
import type { ScatterAreaConfig } from '../types'

const baseConfig: ScatterAreaConfig = {
  center: [0, 0, 0],
  variation: [0, 0, 50],
  baseSize: [6, 9, 1],
  sizeVariation: 0.05,
  rotationVariation: (2 * Math.PI) / 180,
  frequency: 20,
  distanceMin: 12,
  distanceMax: 60,
  heightOffset: 0,
  seed: 100,
  opacity: 1
}

const path = createTrackPath(7)

const place = (
  overrides: Partial<ScatterAreaConfig> = {},
  placement: 'sides' | 'track' | 'background' = 'sides'
) =>
  placeScatterInstances({
    path,
    config: { ...baseConfig, ...overrides },
    placement,
    fromDistance: 0,
    toDistance: 200,
    seed: 555,
    textureCount: 3
  })

describe('scatterInstanceCount', () => {
  it.each([
    [20, 100, 20],
    [20, 200, 40],
    [0, 500, 0],
    [50, 0, 0]
  ])('frequency %i over %i units places %i instances', (frequency, length, expected) => {
    expect(scatterInstanceCount(frequency, length)).toBe(expected)
  })

  it('treats frequency as instances per SCATTER_FREQUENCY_UNIT', () => {
    expect(scatterInstanceCount(7, SCATTER_FREQUENCY_UNIT)).toBe(7)
  })

  it('never returns a negative count', () => {
    expect(scatterInstanceCount(-5, 100)).toBe(0)
    expect(scatterInstanceCount(5, -100)).toBe(0)
  })
})

describe('applyVariation', () => {
  it.each([
    [10, 2, 0, 8],
    [10, 2, 0.5, 10],
    [10, 2, 1, 12]
  ])('base %i +/- %i at sample %f is %f', (base, variation, sample, expected) => {
    expect(applyVariation(base, variation, sample)).toBeCloseTo(expected)
  })

  it('returns the base when there is no variation', () => {
    expect(applyVariation(42, 0, 0.9)).toBe(42)
  })
})

describe('lateralOffset', () => {
  it('mirrors side areas onto both banks', () => {
    const left = lateralOffset('sides', baseConfig, 0.1, 0.5)
    const right = lateralOffset('sides', baseConfig, 0.9, 0.5)

    expect(left).toBeLessThan(0)
    expect(right).toBeGreaterThan(0)
    expect(Math.abs(left)).toBeCloseTo(Math.abs(right))
  })

  it('keeps side areas clear of the deck even when the band starts inside it', () => {
    const offset = lateralOffset('sides', { ...baseConfig, distanceMin: 0 }, 0.9, 0)

    expect(offset).toBeGreaterThanOrEqual(TRACK_HALF_WIDTH)
  })

  it('stays inside the requested band', () => {
    const offsets = Array.from({ length: 50 }, (_, index) =>
      Math.abs(lateralOffset('sides', baseConfig, 0.9, index / 50))
    )

    expect(Math.min(...offsets)).toBeGreaterThanOrEqual(baseConfig.distanceMin)
    expect(Math.max(...offsets)).toBeLessThanOrEqual(baseConfig.distanceMax)
  })

  it('confines on-track areas to the deck', () => {
    const config = { ...baseConfig, distanceMin: 0, distanceMax: 500 }
    const offsets = Array.from({ length: 50 }, (_, index) =>
      Math.abs(lateralOffset('track', config, 0.9, index / 50))
    )

    expect(Math.max(...offsets)).toBeLessThanOrEqual(TRACK_HALF_WIDTH)
  })

  it('tolerates a reversed band', () => {
    const offset = Math.abs(
      lateralOffset('sides', { ...baseConfig, distanceMin: 60, distanceMax: 12 }, 0.9, 0.5)
    )

    expect(offset).toBeGreaterThanOrEqual(12)
    expect(offset).toBeLessThanOrEqual(60)
  })
})

describe('placeScatterInstances', () => {
  it('places the count the frequency asks for', () => {
    expect(place()).toHaveLength(40)
  })

  it('is deterministic for the same seed', () => {
    const first = place().map((instance) => instance.position.toArray())
    const second = place().map((instance) => instance.position.toArray())

    expect(first).toEqual(second)
  })

  it('differs for a different seed', () => {
    const other = placeScatterInstances({
      path,
      config: baseConfig,
      placement: 'sides',
      fromDistance: 0,
      toDistance: 200,
      seed: 556,
      textureCount: 3
    })

    expect(other[0].position.toArray()).not.toEqual(place()[0].position.toArray())
  })

  it('keeps every instance inside the requested stretch, so chunks never overlap', () => {
    const instances = placeScatterInstances({
      path,
      config: baseConfig,
      placement: 'sides',
      fromDistance: 400,
      toDistance: 600,
      seed: 9,
      textureCount: 1
    })

    instances.forEach((instance) => {
      expect(instance.distance).toBeGreaterThanOrEqual(400)
      expect(instance.distance).toBeLessThanOrEqual(600)
    })
  })

  it('never places a side instance on the deck', () => {
    place().forEach((instance) => {
      const sample = path.sampleAt(instance.distance)
      const offset = Math.hypot(
        instance.position.x - sample.position.x,
        instance.position.z - sample.position.z
      )

      expect(offset).toBeGreaterThanOrEqual(TRACK_HALF_WIDTH)
    })
  })

  it('keeps on-track instances on the deck', () => {
    place({ distanceMin: 0, distanceMax: 500 }, 'track').forEach((instance) => {
      const sample = path.sampleAt(instance.distance)
      const offset = Math.hypot(
        instance.position.x - sample.position.x,
        instance.position.z - sample.position.z
      )

      expect(offset).toBeLessThanOrEqual(TRACK_HALF_WIDTH + 1e-6)
    })
  })

  it('varies size within the configured percentage', () => {
    const instances = place({ sizeVariation: 0.05 })
    const widths = instances.map((instance) => instance.width)

    expect(Math.min(...widths)).toBeGreaterThanOrEqual(baseConfig.baseSize[0] * 0.95 - 1e-6)
    expect(Math.max(...widths)).toBeLessThanOrEqual(baseConfig.baseSize[0] * 1.05 + 1e-6)
  })

  it('keeps every size positive even with an extreme variation', () => {
    place({ sizeVariation: 5 }).forEach((instance) => {
      expect(instance.width).toBeGreaterThan(0)
      expect(instance.height).toBeGreaterThan(0)
    })
  })

  it('varies rotation within the configured amount of the local heading', () => {
    const variation = (2 * Math.PI) / 180

    place({ rotationVariation: variation }).forEach((instance) => {
      const heading = path.sampleAt(instance.distance).yaw

      expect(Math.abs(instance.yaw - heading)).toBeLessThanOrEqual(variation + 1e-6)
    })
  })

  it('faces the local heading exactly when rotation variation is off', () => {
    place({ rotationVariation: 0 }).forEach((instance) => {
      expect(instance.yaw).toBeCloseTo(path.sampleAt(instance.distance).yaw)
    })
  })

  it('sits each billboard on the ground plus its height offset', () => {
    const instances = placeScatterInstances({
      path,
      config: {
        ...baseConfig,
        heightOffset: 3,
        sizeVariation: 0,
        variation: [0, 0, 0],
        frequency: 1
      },
      placement: 'sides',
      fromDistance: 0,
      toDistance: 100,
      seed: 1,
      textureCount: 1
    })
    const instance = instances[0]
    const ground = path.sampleAt(50).position.y

    expect(instance.position.y).toBeCloseTo(ground + 3 + instance.height / 2)
  })

  it('offsets every instance by the area centre', () => {
    const shared = { variation: [0, 0, 0] as [number, number, number], sizeVariation: 0 }
    const centred = place({ ...shared, center: [0, 0, 0] })
    const raised = place({ ...shared, center: [0, 12, 0] })

    centred.forEach((instance, index) =>
      expect(raised[index].position.y - instance.position.y).toBeCloseTo(12)
    )
  })

  it('spreads instances vertically by the area size Y', () => {
    const flat = place({ variation: [0, 0, 0], sizeVariation: 0 }).map(
      (instance) => instance.position.y
    )
    const spread = place({ variation: [0, 8, 0], sizeVariation: 0 }).map(
      (instance) => instance.position.y
    )

    const flatRange = Math.max(...flat) - Math.min(...flat)
    const spreadRange = Math.max(...spread) - Math.min(...spread)
    expect(spreadRange).toBeGreaterThan(flatRange)
  })

  it('spreads instances laterally by the area size X', () => {
    const offsets = (variationX: number) =>
      place({ variation: [variationX, 0, 0], sizeVariation: 0 }).map((instance) => {
        const sample = path.sampleAt(instance.distance)
        return Math.hypot(
          instance.position.x - sample.position.x,
          instance.position.z - sample.position.z
        )
      })

    const tight = offsets(0)
    const wide = offsets(20)

    expect(Math.max(...wide)).toBeGreaterThan(Math.max(...tight))
  })

  it('spreads instances across every available texture', () => {
    const indices = new Set(place().map((instance) => instance.textureIndex))

    expect(indices.size).toBeGreaterThan(1)
    indices.forEach((index) => expect(index).toBeLessThan(3))
  })

  it('returns nothing when the area has no textures', () => {
    const instances = placeScatterInstances({
      path,
      config: baseConfig,
      placement: 'sides',
      fromDistance: 0,
      toDistance: 200,
      seed: 1,
      textureCount: 0
    })

    expect(instances).toEqual([])
  })

  it('returns nothing at zero frequency', () => {
    expect(place({ frequency: 0 })).toEqual([])
  })
})
