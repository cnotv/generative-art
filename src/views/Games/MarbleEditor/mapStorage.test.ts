import { describe, it, expect, beforeEach } from 'vitest'
import {
  saveCurrentMap,
  loadCurrentMap,
  listSavedMaps,
  saveMapAs,
  deleteSavedMap,
  STORAGE_KEY_CURRENT,
  STORAGE_KEY_SAVED
} from './mapStorage'
import { SAMPLE_MAPS } from './sampleMaps'
import type { MarbleMap } from './types'

const makeMap = (name: string): MarbleMap => ({
  version: 1,
  name,
  updatedAt: 1000,
  pieces: [
    { id: 'start-0', type: 'start', color: 0x4caf50 },
    { id: 'finish-1', type: 'finish', color: 0xffd700 }
  ]
})

beforeEach(() => {
  localStorage.clear()
})

describe('current map persistence', () => {
  it('round-trips the current map', () => {
    const map = makeMap('My track')

    saveCurrentMap(map)

    expect(loadCurrentMap()).toEqual(map)
  })

  it('returns null when nothing is stored', () => {
    expect(loadCurrentMap()).toBeNull()
  })

  it('returns null for invalid JSON', () => {
    localStorage.setItem(STORAGE_KEY_CURRENT, 'not json {')
    expect(loadCurrentMap()).toBeNull()
  })

  it('returns null for an unknown schema version', () => {
    localStorage.setItem(STORAGE_KEY_CURRENT, JSON.stringify({ ...makeMap('x'), version: 99 }))
    expect(loadCurrentMap()).toBeNull()
  })

  it('returns null when a piece has an unknown type', () => {
    const corrupted = {
      ...makeMap('x'),
      pieces: [{ id: 'a', type: 'teleporter', color: 0 }]
    }
    localStorage.setItem(STORAGE_KEY_CURRENT, JSON.stringify(corrupted))
    expect(loadCurrentMap()).toBeNull()
  })
})

describe('named map slots', () => {
  it('saves and lists named maps', () => {
    saveMapAs(makeMap('ignored'), 'Alpha')
    const maps = saveMapAs(makeMap('ignored'), 'Beta')

    expect(maps.map((m) => m.name)).toEqual(['Alpha', 'Beta'])
    expect(listSavedMaps().map((m) => m.name)).toEqual(['Alpha', 'Beta'])
  })

  it('overwrites a map saved under an existing name', () => {
    saveMapAs(makeMap('v1'), 'Alpha')
    const updated = { ...makeMap('v2'), updatedAt: 2000 }

    const maps = saveMapAs(updated, 'Alpha')

    expect(maps).toHaveLength(1)
    expect(maps[0].updatedAt).toBe(2000)
  })

  it('deletes a named map', () => {
    saveMapAs(makeMap('x'), 'Alpha')
    saveMapAs(makeMap('x'), 'Beta')

    const remaining = deleteSavedMap('Alpha')

    expect(remaining.map((m) => m.name)).toEqual(['Beta'])
    expect(listSavedMaps().map((m) => m.name)).toEqual(['Beta'])
  })

  it('returns an empty list for corrupted saved data', () => {
    localStorage.setItem(STORAGE_KEY_SAVED, '{"nope"')
    expect(listSavedMaps()).toEqual([])
  })
})

describe('SAMPLE_MAPS', () => {
  it('ships at least three sample maps', () => {
    expect(SAMPLE_MAPS.length).toBeGreaterThanOrEqual(3)
  })

  it.each(SAMPLE_MAPS.map((map) => [map.name, map] as const))(
    '%s starts with a start piece and ends with a finish piece',
    (_name, map) => {
      expect(map.pieces[0].type).toBe('start')
      expect(map.pieces[map.pieces.length - 1].type).toBe('finish')
    }
  )

  it.each(SAMPLE_MAPS.map((map) => [map.name, map] as const))(
    '%s has unique piece ids',
    (_name, map) => {
      const ids = map.pieces.map((piece) => piece.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  )

  it('covers funnel, loop and gap-jump across the samples', () => {
    const allTypes = SAMPLE_MAPS.flatMap((map) => map.pieces.map((piece) => piece.type))
    expect(allTypes).toContain('funnel')
    expect(allTypes).toContain('loop')
    expect(allTypes).toContain('gap-jump')
  })

  it('includes one map combining funnel, loop and gap-jump', () => {
    const combined = SAMPLE_MAPS.find((map) => {
      const types = map.pieces.map((piece) => piece.type)
      return types.includes('funnel') && types.includes('loop') && types.includes('gap-jump')
    })
    expect(combined).toBeDefined()
  })
})
