import { describe, it, expect, vi, beforeEach } from 'vitest'
import { STRUDEL_BANK_ALIASES_URL, STRUDEL_SAMPLE_BANKS } from './config'
import {
  matchesStrudelSoundFilter,
  registerStrudelSoundLibrary,
  toStrudelSoundEntries
} from './strudelSoundLibrary'
import type { StrudelSoundEntry, StrudelSoundFilter } from './types'

const { mockSynthRegistrar, mockSoundfontRegistrar, mockSampleBankLoader, mockBankAliasLoader } =
  vi.hoisted(() => ({
    mockSynthRegistrar: vi.fn(),
    mockSoundfontRegistrar: vi.fn(),
    mockSampleBankLoader: vi.fn(),
    mockBankAliasLoader: vi.fn()
  }))

vi.mock('@strudel/webaudio', () => ({
  registerSynthSounds: mockSynthRegistrar,
  samples: mockSampleBankLoader,
  aliasBank: mockBankAliasLoader
}))
vi.mock('@strudel/soundfonts', () => ({
  registerSoundfonts: mockSoundfontRegistrar
}))

const buildSoundEntry = (overrides: Partial<StrudelSoundEntry>): StrudelSoundEntry => ({
  name: 'bd',
  type: 'sample',
  tag: '',
  sampleCount: 1,
  ...overrides
})

describe('registerStrudelSoundLibrary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('registers the synths and the General MIDI soundfonts', async () => {
    // Arrange
    const libraryRegistration = registerStrudelSoundLibrary

    // Act
    await libraryRegistration()

    // Assert
    expect(mockSynthRegistrar).toHaveBeenCalledTimes(1)
    expect(mockSoundfontRegistrar).toHaveBeenCalledTimes(1)
  })

  it('loads every strudel.cc bank from its CDN folder, then the drum machine aliases', async () => {
    // Arrange
    const libraryRegistration = registerStrudelSoundLibrary

    // Act
    await libraryRegistration()

    // Assert
    const loadedManifests = mockSampleBankLoader.mock.calls.map(([manifestUrl]) => manifestUrl)
    expect(loadedManifests).toEqual(STRUDEL_SAMPLE_BANKS.map(({ manifestUrl }) => manifestUrl))
    expect(mockSampleBankLoader).toHaveBeenCalledWith(
      'https://strudel.b-cdn.net/tidal-drum-machines.json',
      'https://strudel.b-cdn.net/tidal-drum-machines/machines/',
      { prebake: true, tag: 'drum-machines' }
    )
    expect(mockBankAliasLoader).toHaveBeenCalledWith(STRUDEL_BANK_ALIASES_URL)
    const lastBankOrder = Math.max(...mockSampleBankLoader.mock.invocationCallOrder)
    const aliasOrder = mockBankAliasLoader.mock.invocationCallOrder[0] ?? 0
    expect(lastBankOrder).toBeLessThan(aliasOrder)
  })

  it('still finishes when one sample bank fails to load', async () => {
    // Arrange
    mockSampleBankLoader.mockRejectedValueOnce(new Error('error loading manifest'))

    // Act
    const registration = registerStrudelSoundLibrary()

    // Assert
    await expect(registration).resolves.toBeUndefined()
    expect(mockBankAliasLoader).toHaveBeenCalledTimes(1)
  })
})

describe('toStrudelSoundEntries', () => {
  it('lists one entry per sound, keeping a bank over its alias and dropping _base, by name', () => {
    // Arrange
    const drumMachineKick = {
      data: { type: 'sample', tag: 'drum-machines', samples: ['a.wav', 'b.wav'] }
    }
    const soundDictionary = {
      rolandtr909_bd: drumMachineKick,
      tr909_bd: drumMachineKick,
      piano: { data: { type: 'sample', samples: { A0: 'a0.mp3', C1: 'c1.mp3', Ds1: 'ds1.mp3' } } },
      gm_piano: { data: { type: 'soundfont', fonts: ['0000_JCLive'] } },
      sawtooth: { data: { type: 'synth' } },
      _base: { data: { type: 'sample', samples: 'https://example.com/' } }
    }

    // Act
    const soundEntries = toStrudelSoundEntries(soundDictionary)

    // Assert
    expect(soundEntries).toEqual([
      { name: 'gm_piano', type: 'soundfont', tag: '', sampleCount: 1 },
      { name: 'piano', type: 'sample', tag: '', sampleCount: 3 },
      { name: 'rolandtr909_bd', type: 'sample', tag: 'drum-machines', sampleCount: 2 },
      { name: 'sawtooth', type: 'synth', tag: '', sampleCount: 0 }
    ])
  })

  it('returns nothing for a sound map that is not an object', () => {
    // Arrange
    const soundDictionary = undefined

    // Act
    const soundEntries = toStrudelSoundEntries(soundDictionary)

    // Assert
    expect(soundEntries).toEqual([])
  })
})

describe('matchesStrudelSoundFilter', () => {
  const dirtSample = buildSoundEntry({ name: 'bd' })
  const drumMachine = buildSoundEntry({ name: 'RolandTR909_bd', tag: 'drum-machines' })
  const synth = buildSoundEntry({ name: 'sawtooth', type: 'synth' })
  const soundfont = buildSoundEntry({ name: 'gm_piano', type: 'soundfont' })
  const wavetable = buildSoundEntry({ name: 'wt_digital', type: 'wavetable' })

  it.each<[StrudelSoundFilter, StrudelSoundEntry[]]>([
    ['all', [dirtSample, drumMachine, synth, soundfont, wavetable]],
    ['samples', [dirtSample]],
    ['drum-machines', [drumMachine]],
    ['synths', [synth, soundfont]],
    ['wavetables', [wavetable]]
  ])('the %s filter lists only its own sounds', (soundFilter, expectedSounds) => {
    // Arrange
    const soundEntries = [dirtSample, drumMachine, synth, soundfont, wavetable]

    // Act
    const listedSounds = soundEntries.filter((soundEntry) =>
      matchesStrudelSoundFilter(soundEntry, soundFilter)
    )

    // Assert
    expect(listedSounds).toEqual(expectedSounds)
  })
})
