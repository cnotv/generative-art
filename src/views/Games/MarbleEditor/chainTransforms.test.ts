import { describe, it, expect } from 'vitest'
import { computeChainTransforms } from './chainTransforms'
import { PIECE_CATALOG } from './pieceCatalog'
import {
  STRAIGHT_SHORT_LENGTH,
  CURVE_RADIUS,
  CURVE_DROP,
  RAMP_LENGTH,
  RAMP_ANGLE,
  RAMP_LIP_LENGTH,
  FUNNEL_DROP_HEIGHT
} from './config'
import type { PlacedPiece, TrackPieceType } from './types'

const makePieces = (types: TrackPieceType[]): PlacedPiece[] =>
  types.map((type, index) => ({ id: `${type}-${index}`, type, color: 0xffffff }))

describe('PIECE_CATALOG', () => {
  const catalogEntries = Object.entries(PIECE_CATALOG) as [
    TrackPieceType,
    (typeof PIECE_CATALOG)[TrackPieceType]
  ][]

  it.each(catalogEntries)('%s spec type matches its key', (key, spec) => {
    expect(spec.type).toBe(key)
  })

  it.each(catalogEntries)('%s has a label and a default color', (_key, spec) => {
    expect(spec.label.length).toBeGreaterThan(0)
    expect(spec.defaultColor).toBeGreaterThanOrEqual(0)
  })

  it('curve-right mirrors curve-left', () => {
    const left = PIECE_CATALOG['curve-left']
    const right = PIECE_CATALOG['curve-right']
    expect(right.exitOffset[0]).toBeCloseTo(-left.exitOffset[0])
    expect(right.exitOffset[2]).toBeCloseTo(left.exitOffset[2])
    expect(right.exitYawDelta).toBeCloseTo(-left.exitYawDelta)
  })

  it('ramp-down mirrors ramp-up vertically', () => {
    const up = PIECE_CATALOG['ramp-up']
    const down = PIECE_CATALOG['ramp-down']
    expect(down.exitOffset[1]).toBeCloseTo(-up.exitOffset[1])
    expect(down.exitOffset[2]).toBeCloseTo(up.exitOffset[2])
  })
})

describe('computeChainTransforms', () => {
  it('returns an empty list for an empty map', () => {
    expect(computeChainTransforms([])).toEqual([])
  })

  it('places the first piece at the origin with zero yaw', () => {
    const [first] = computeChainTransforms(makePieces(['straight-short']))
    expect(first.position).toEqual([0, 0, 0])
    expect(first.yaw).toBe(0)
  })

  it('advances along -Z after a straight piece', () => {
    const transforms = computeChainTransforms(makePieces(['straight-short', 'straight-short']))
    expect(transforms[1].position[0]).toBeCloseTo(0)
    expect(transforms[1].position[1]).toBeCloseTo(0)
    expect(transforms[1].position[2]).toBeCloseTo(-STRAIGHT_SHORT_LENGTH)
    expect(transforms[1].yaw).toBeCloseTo(0)
  })

  it('turns the chain heading after a curve-left', () => {
    const transforms = computeChainTransforms(
      makePieces(['straight-short', 'curve-left', 'straight-short'])
    )
    expect(transforms[2].position[0]).toBeCloseTo(-CURVE_RADIUS)
    expect(transforms[2].position[2]).toBeCloseTo(-STRAIGHT_SHORT_LENGTH - CURVE_RADIUS)
    expect(transforms[2].yaw).toBeCloseTo(Math.PI / 2)
  })

  it('spirals a full turn after four curve-lefts, closing in x/z and dropping in y', () => {
    const transforms = computeChainTransforms(
      makePieces(['curve-left', 'curve-left', 'curve-left', 'curve-left', 'straight-short'])
    )
    const closing = transforms[4]
    expect(closing.position[0]).toBeCloseTo(0)
    expect(closing.position[1]).toBeCloseTo(-4 * CURVE_DROP)
    expect(closing.position[2]).toBeCloseTo(0)
    expect(closing.yaw).toBeCloseTo(2 * Math.PI)
  })

  it('raises the chain after a ramp-up', () => {
    const transforms = computeChainTransforms(makePieces(['ramp-up', 'straight-short']))
    expect(transforms[1].position[1]).toBeCloseTo(RAMP_LENGTH * Math.sin(RAMP_ANGLE))
    expect(transforms[1].position[2]).toBeCloseTo(
      -(RAMP_LENGTH * Math.cos(RAMP_ANGLE) + 2 * RAMP_LIP_LENGTH)
    )
  })

  it('lowers the chain after a funnel drop', () => {
    const transforms = computeChainTransforms(makePieces(['funnel', 'straight-short']))
    expect(transforms[1].position[1]).toBeCloseTo(-FUNNEL_DROP_HEIGHT)
  })

  it('applies accumulated yaw to later offsets', () => {
    const transforms = computeChainTransforms(
      makePieces(['curve-left', 'straight-short', 'straight-short'])
    )
    expect(transforms[2].position[0]).toBeCloseTo(-CURVE_RADIUS - STRAIGHT_SHORT_LENGTH)
    expect(transforms[2].position[2]).toBeCloseTo(-CURVE_RADIUS)
    expect(transforms[2].yaw).toBeCloseTo(Math.PI / 2)
  })
})
