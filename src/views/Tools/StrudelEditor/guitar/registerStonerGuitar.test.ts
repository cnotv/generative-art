import { afterEach, describe, expect, it, vi } from 'vitest'
import { STONER_GUITAR_DEFAULT_TONE, STONER_GUITAR_TAG } from './config'
import { buildStonerGuitarSampleMap, registerStonerGuitar } from './registerStonerGuitar'
import type { StonerGuitarWavFile } from './types'

const files: StonerGuitarWavFile[] = [
  { soundName: 'stoner_chord', noteName: 'c2', wav: new ArrayBuffer(4) },
  { soundName: 'stoner_chord', noteName: 'ds2', wav: new ArrayBuffer(4) },
  { soundName: 'stoner_note', noteName: 'c2', wav: new ArrayBuffer(4) }
]

describe('buildStonerGuitarSampleMap', () => {
  it('nests each url under its sound and note', () => {
    // Arrange
    const urls = ['u0', 'u1', 'u2']

    // Act
    const sampleMap = buildStonerGuitarSampleMap(files, urls)

    // Assert
    expect(sampleMap).toEqual({
      stoner_chord: { c2: ['u0'], ds2: ['u1'] },
      stoner_note: { c2: ['u2'] }
    })
  })
})

describe('registerStonerGuitar', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('registers blob urls with the tag and revokes the previous ones on the next call', async () => {
    // Arrange
    const created = { count: 0 }
    const mockRevoke = vi.fn()
    vi.stubGlobal('URL', {
      createObjectURL: () => `blob:${created.count++}`,
      revokeObjectURL: mockRevoke
    })
    const mockSamples = vi.fn()
    const options = {
      samples: mockSamples,
      tone: STONER_GUITAR_DEFAULT_TONE,
      renderFiles: async () => files
    }

    // Act
    await registerStonerGuitar(options)
    await registerStonerGuitar(options)

    // Assert
    expect(mockSamples).toHaveBeenCalledWith(
      { stoner_chord: { c2: ['blob:3'], ds2: ['blob:4'] }, stoner_note: { c2: ['blob:5'] } },
      '',
      { tag: STONER_GUITAR_TAG }
    )
    expect(mockRevoke.mock.calls.map(([url]) => url)).toEqual(['blob:0', 'blob:1', 'blob:2'])
  })
})
