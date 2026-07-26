import { describe, it, expect } from 'vitest'
import { buildScatterPanelConfig, toScatterAreaConfig } from './scatterPanel'
import { SCATTER_AREAS, SCATTER_ROTATION_VARIATION, SCATTER_SIZE_VARIATION } from './illustrations'
import type { ScatterAreaDefinition } from '../types'

const DEGREES_PER_RADIAN = 180 / Math.PI

const definition = (name: string): ScatterAreaDefinition =>
  SCATTER_AREAS.find((area) => area.name === name) as ScatterAreaDefinition

describe('buildScatterPanelConfig', () => {
  it('carries the catalog values into the panel tree', () => {
    const tree = definition('tree')
    const config = buildScatterPanelConfig(tree)

    expect(config.scatter.frequency).toBe(tree.frequency)
    expect(config.scatter.distanceMin).toBe(tree.distanceMin)
    expect(config.scatter.distanceMax).toBe(tree.distanceMax)
    expect(config.scatter.heightOffset).toBe(tree.heightOffset)
    expect(config.instances.seed).toBe(tree.seed)
  })

  it('maps the catalog variation onto area.size, X lateral, Y vertical, Z along the track', () => {
    const config = buildScatterPanelConfig(definition('tree'))
    const [x, y, z] = definition('tree').variation

    expect(config.area.size).toEqual({ x, y, z })
  })

  it('starts every area at a zero offset', () => {
    SCATTER_AREAS.forEach((area) => {
      expect(buildScatterPanelConfig(area).area.center).toEqual({ x: 0, y: 0, z: 0 })
    })
  })

  it('uses an area own size and rotation variation when it sets them', () => {
    const tree = definition('tree')
    const config = buildScatterPanelConfig(tree)

    expect(tree.sizeVariation).toBeDefined()
    expect(config.textures.sizeVariation).toBe(tree.sizeVariation)
    expect(config.textures.rotationVariation).toBe(tree.rotationVariation)
  })

  it('falls back to the shared variation for areas that set none', () => {
    const bush = definition('bush')
    const config = buildScatterPanelConfig(bush)

    expect(bush.sizeVariation).toBeUndefined()
    expect(config.textures.sizeVariation).toBe(SCATTER_SIZE_VARIATION)
    expect(config.textures.rotationVariation).toBeCloseTo(
      SCATTER_ROTATION_VARIATION * DEGREES_PER_RADIAN
    )
  })
})

describe('toScatterAreaConfig', () => {
  it('round-trips a catalog entry into the shape the placement maths takes', () => {
    const tree = definition('tree')
    const config = toScatterAreaConfig(buildScatterPanelConfig(tree))

    expect(config.baseSize).toEqual(tree.baseSize)
    expect(config.variation).toEqual(tree.variation)
    expect(config.frequency).toBe(tree.frequency)
    expect(config.seed).toBe(tree.seed)
  })

  // The panel edits degrees because that is what a person reasons about; the
  // placement maths works in radians.
  it('converts the panel degrees back to radians', () => {
    const config = toScatterAreaConfig(buildScatterPanelConfig(definition('tree')))
    const degrees = definition('tree').rotationVariation as number

    expect(config.rotationVariation).toBeCloseTo(degrees / DEGREES_PER_RADIAN)
  })

  it('reads the offset and spread back off area.center and area.size', () => {
    const panelConfig = buildScatterPanelConfig(definition('tree'))
    panelConfig.area.center = { x: 3, y: -2, z: 12 }
    panelConfig.area.size = { x: 5, y: 6, z: 7 }

    const config = toScatterAreaConfig(panelConfig)

    expect(config.center).toEqual([3, -2, 12])
    expect(config.variation).toEqual([5, 6, 7])
  })
})
