import { describe, it, expect } from 'vitest'
import { createEmptyMap, appendPiece, insertPiece, removePiece, recolorPiece } from './editorOps'
import { PIECE_CATALOG } from './pieceCatalog'
import type { MarbleMap } from './types'

const pieceTypes = (map: MarbleMap): string[] => map.pieces.map((piece) => piece.type)

describe('createEmptyMap', () => {
  it('creates a map with only start and finish', () => {
    const map = createEmptyMap('Fresh')

    expect(map.name).toBe('Fresh')
    expect(map.version).toBe(1)
    expect(pieceTypes(map)).toEqual(['start', 'finish'])
  })

  it('assigns unique ids and default colors', () => {
    const map = createEmptyMap('Fresh')

    expect(map.pieces[0].id).not.toBe(map.pieces[1].id)
    expect(map.pieces[0].color).toBe(PIECE_CATALOG.start.defaultColor)
  })
})

describe('appendPiece', () => {
  it('appends before the finish piece', () => {
    const map = appendPiece(createEmptyMap('m'), 'straight-short')

    expect(pieceTypes(map)).toEqual(['start', 'straight-short', 'finish'])
  })

  it.each([
    ['curve-left', ['start', 'straight-short', 'curve-left', 'finish']],
    ['loop', ['start', 'straight-short', 'loop', 'finish']]
  ] as const)('appends %s at the end of the chain body', (type, expected) => {
    const map = appendPiece(appendPiece(createEmptyMap('m'), 'straight-short'), type)

    expect(pieceTypes(map)).toEqual([...expected])
  })

  it('ignores a second start or finish', () => {
    const map = createEmptyMap('m')

    expect(pieceTypes(appendPiece(map, 'start'))).toEqual(['start', 'finish'])
    expect(pieceTypes(appendPiece(map, 'finish'))).toEqual(['start', 'finish'])
  })

  it('returns a new map with a bumped timestamp', () => {
    const map = createEmptyMap('m')
    const next = appendPiece(map, 'straight-short')

    expect(next).not.toBe(map)
    expect(map.pieces).toHaveLength(2)
    expect(next.updatedAt).toBeGreaterThanOrEqual(map.updatedAt)
  })
})

describe('insertPiece', () => {
  it('inserts at the given index', () => {
    const base = appendPiece(appendPiece(createEmptyMap('m'), 'straight-short'), 'curve-left')

    const map = insertPiece(base, 2, 'ramp-up')

    expect(pieceTypes(map)).toEqual(['start', 'straight-short', 'ramp-up', 'curve-left', 'finish'])
  })

  it('clamps the index so start stays first and finish stays last', () => {
    const base = appendPiece(createEmptyMap('m'), 'straight-short')

    expect(pieceTypes(insertPiece(base, 0, 'loop'))).toEqual([
      'start',
      'loop',
      'straight-short',
      'finish'
    ])
    expect(pieceTypes(insertPiece(base, 99, 'loop'))).toEqual([
      'start',
      'straight-short',
      'loop',
      'finish'
    ])
  })

  it('ignores start and finish types', () => {
    const base = appendPiece(createEmptyMap('m'), 'straight-short')

    expect(insertPiece(base, 1, 'start')).toBe(base)
    expect(insertPiece(base, 1, 'finish')).toBe(base)
  })
})

describe('removePiece', () => {
  it('removes a body piece by id', () => {
    const base = appendPiece(createEmptyMap('m'), 'straight-short')
    const target = base.pieces[1]

    const map = removePiece(base, target.id)

    expect(pieceTypes(map)).toEqual(['start', 'finish'])
  })

  it.each(['start', 'finish'] as const)('refuses to remove the %s piece', (type) => {
    const base = createEmptyMap('m')
    const target = base.pieces.find((piece) => piece.type === type)!

    expect(removePiece(base, target.id)).toBe(base)
  })

  it('returns the same map for an unknown id', () => {
    const base = createEmptyMap('m')
    expect(removePiece(base, 'missing')).toBe(base)
  })
})

describe('recolorPiece', () => {
  it('changes only the target piece color', () => {
    const base = appendPiece(createEmptyMap('m'), 'straight-short')
    const target = base.pieces[1]

    const map = recolorPiece(base, target.id, 0x123456)

    expect(map.pieces[1].color).toBe(0x123456)
    expect(map.pieces[0].color).toBe(base.pieces[0].color)
  })

  it('returns the same map for an unknown id', () => {
    const base = createEmptyMap('m')
    expect(recolorPiece(base, 'missing', 0xffffff)).toBe(base)
  })
})
