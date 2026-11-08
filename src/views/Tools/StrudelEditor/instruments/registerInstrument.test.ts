import { afterEach, describe, expect, it, vi } from 'vitest'
import { INSTRUMENT_BUILT_IN_PRESETS } from './config'
import {
  buildInstrumentSampleMap,
  buildInstrumentTag,
  registerInstrument
} from './registerInstrument'
import type { InstrumentWavFile } from './types'

const files: InstrumentWavFile[] = [
  { soundName: 'stoner_chord', noteName: 'c2', wav: new ArrayBuffer(4) },
  { soundName: 'stoner_chord', noteName: 'ds2', wav: new ArrayBuffer(4) },
  { soundName: 'stoner_note', noteName: 'c2', wav: new ArrayBuffer(4) }
]
const drumFiles: InstrumentWavFile[] = [
  { soundName: 'blastkit_kick', noteName: null, wav: new ArrayBuffer(4) },
  { soundName: 'blastkit_snare', noteName: null, wav: new ArrayBuffer(4) }
]
const [stoner, , , , , , , , , , blastkit] = INSTRUMENT_BUILT_IN_PRESETS

describe('buildInstrumentSampleMap', () => {
  it('nests each pitched url under its sound and note', () => {
    // Arrange
    const urls = ['u0', 'u1', 'u2']

    // Act
    const sampleMap = buildInstrumentSampleMap(files, urls)

    // Assert
    expect(sampleMap).toEqual({
      stoner_chord: { c2: ['u0'], ds2: ['u1'] },
      stoner_note: { c2: ['u2'] }
    })
  })

  it('registers an unpitched sound as a plain list', () => {
    // Arrange
    const urls = ['k', 's']

    // Act
    const sampleMap = buildInstrumentSampleMap(drumFiles, urls)

    // Assert
    expect(sampleMap).toEqual({ blastkit_kick: ['k'], blastkit_snare: ['s'] })
  })
})

describe('buildInstrumentTag', () => {
  it('carries the kind and the name, for the sounds tab to group by', () => {
    // Arrange
    const preset = blastkit

    // Act
    const tag = preset === undefined ? '' : buildInstrumentTag(preset)

    // Assert
    expect(tag).toBe('instrument:drum-kit:blastkit')
  })
})

describe('registerInstrument', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('registers blob urls with the tag and revokes only that preset previous ones on the next call', async () => {
    // Arrange
    const created = { count: 0 }
    const mockRevoke = vi.fn()
    vi.stubGlobal('URL', {
      createObjectURL: () => `blob:${created.count++}`,
      revokeObjectURL: mockRevoke
    })
    const mockSamples = vi.fn()
    if (stoner === undefined || blastkit === undefined) {
      throw new Error('built-in presets missing')
    }
    const stonerOptions = { samples: mockSamples, preset: stoner, renderFiles: async () => files }
    const kitOptions = {
      samples: mockSamples,
      preset: blastkit,
      renderFiles: async () => drumFiles
    }

    // Act
    await registerInstrument(stonerOptions)
    await registerInstrument(kitOptions)
    await registerInstrument(stonerOptions)

    // Assert
    expect(mockSamples).toHaveBeenLastCalledWith(
      { stoner_chord: { c2: ['blob:5'], ds2: ['blob:6'] }, stoner_note: { c2: ['blob:7'] } },
      '',
      { tag: 'instrument:electric-guitar:stoner' }
    )
    expect(mockRevoke.mock.calls.map(([url]) => url)).toEqual(['blob:0', 'blob:1', 'blob:2'])
  })
})
