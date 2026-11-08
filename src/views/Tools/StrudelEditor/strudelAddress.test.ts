import { describe, it, expect } from 'vitest'
import type { LocationQuery } from 'vue-router'
import { readLegacyStrudelAnchor, readStrudelAddress, writeStrudelAddress } from './strudelAddress'
import type { StrudelAddress } from './types'

describe('readStrudelAddress', () => {
  it.each<[string, LocationQuery, StrudelAddress]>([
    ['nothing', {}, { patternId: undefined, tabName: undefined }],
    ['a pattern', { pattern: 'caverave' }, { patternId: 'caverave', tabName: undefined }],
    ['a tab', { tab: 'export' }, { patternId: undefined, tabName: 'export' }],
    ['a mode', { mode: 'flow' }, { patternId: undefined, tabName: undefined, modeName: 'flow' }],
    [
      'a pattern and a tab',
      { pattern: 'caverave', tab: 'export' },
      { patternId: 'caverave', tabName: 'export' }
    ],
    [
      'the first of a repeated key',
      { pattern: ['scope', 'spiral'] },
      { patternId: 'scope', tabName: undefined }
    ],
    [
      'a key with no value as nothing',
      { pattern: null, tab: '' },
      { patternId: undefined, tabName: undefined }
    ]
  ])('reads %s', (_case, query, expectedAddress) => {
    // Arrange
    const routeQuery = query

    // Act
    const address = readStrudelAddress(routeQuery)

    // Assert
    expect(address).toEqual(expectedAddress)
  })
})

describe('writeStrudelAddress', () => {
  it.each<[string, LocationQuery, StrudelAddress, Record<string, unknown>]>([
    [
      'sets a pattern beside the tab',
      { tab: 'import' },
      { patternId: 'scope' },
      { tab: 'import', pattern: 'scope' }
    ],
    [
      'replaces the tab',
      { tab: 'import', pattern: 'scope' },
      { tabName: 'midi' },
      { tab: 'midi', pattern: 'scope' }
    ],
    [
      'removes the tab',
      { tab: 'import', pattern: 'scope' },
      { tabName: undefined },
      { tab: undefined, pattern: 'scope' }
    ],
    [
      'sets the mode beside the others',
      { pattern: 'scope', tab: 'midi' },
      { modeName: 'flow' },
      { pattern: 'scope', tab: 'midi', mode: 'flow' }
    ],
    [
      'removes the mode and keeps the others',
      { pattern: 'scope', mode: 'flow' },
      { modeName: undefined },
      { pattern: 'scope', mode: undefined }
    ],
    [
      'removes both and keeps what is not its own',
      { room: 'abc', tab: 'import', pattern: 'scope' },
      { patternId: undefined, tabName: undefined },
      { room: 'abc', tab: undefined, pattern: undefined }
    ]
  ])('%s', (_case, query, address, expectedQuery) => {
    // Arrange
    const routeQuery = query

    // Act
    const nextQuery = writeStrudelAddress(routeQuery, address)

    // Assert
    expect(nextQuery).toEqual(expectedQuery)
  })
})

describe('readLegacyStrudelAnchor', () => {
  it.each<[string, string, StrudelAddress | null]>([
    ['no anchor', '', null],
    ['a tab', '#export', { tabName: 'export' }],
    ['a pattern', '#caverave', { patternId: 'caverave' }],
    ['an encoded pattern', '#saved-night%20drive', { patternId: 'saved-night drive' }]
  ])('reads %s', (_case, hash, expectedAddress) => {
    // Arrange
    const tabIds = ['import', 'export']

    // Act
    const address = readLegacyStrudelAnchor(hash, tabIds)

    // Assert
    expect(address).toEqual(expectedAddress)
  })
})
