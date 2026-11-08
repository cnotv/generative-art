import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { STRUDEL_BANK_ALIASES_URL, STRUDEL_SAMPLE_BANKS } from './config'
import {
  groupStrudelSoundEntries,
  matchesStrudelSoundFilter,
  readStrudelDrumMachines,
  registerStrudelSoundLibrary,
  toStrudelSoundEntries
} from './strudelSoundLibrary'
import type { StrudelSoundEntry, StrudelSoundFilter, StrudelSoundLibrary } from './types'

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

const ALIAS_LIST = { RolandTR909: 'TR909', AkaiLinn: ['Linn', 'LinnDrum'] }

const DIRT_SAMPLES_BASE = 'https://raw.githubusercontent.com/tidalcycles/dirt-samples/main/'
const DRUM_MACHINES_BASE = 'https://strudel.b-cdn.net/tidal-drum-machines/machines/'

// Each bank list is its own URL, so a test can tell from the arguments which one registered.
const fetchBankList = async (url: string): Promise<Response> =>
  new Response(JSON.stringify(url === STRUDEL_BANK_ALIASES_URL ? ALIAS_LIST : { list: url }))

const SOUND_LIBRARY: StrudelSoundLibrary = {
  drumMachines: readStrudelDrumMachines(ALIAS_LIST)
}

const buildSoundEntry = (overrides: Partial<StrudelSoundEntry>): StrudelSoundEntry => ({
  name: 'bd',
  label: 'Bass drum',
  group: 'Dirt samples',
  type: 'sample',
  tag: '',
  sampleCount: 1,
  ...overrides
})

describe('registerStrudelSoundLibrary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn(fetchBankList))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
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

  it('registers the banks in their configured order, dirt-samples last, from their own folders', async () => {
    // Arrange
    const libraryRegistration = registerStrudelSoundLibrary

    // Act
    await libraryRegistration()

    // Assert
    const registeredLists = mockSampleBankLoader.mock.calls.map(([bankList]) => bankList)
    expect(registeredLists).toEqual(
      STRUDEL_SAMPLE_BANKS.map(({ manifestUrl }) => ({ list: manifestUrl }))
    )
    expect(mockSampleBankLoader.mock.calls.at(-1)?.[1]).toBe(DIRT_SAMPLES_BASE)
    expect(mockSampleBankLoader).toHaveBeenCalledWith(
      { list: 'https://strudel.b-cdn.net/tidal-drum-machines.json' },
      DRUM_MACHINES_BASE,
      { prebake: true, tag: 'drum-machines' }
    )
  })

  it('applies the drum machine aliases after the last bank and returns the machines', async () => {
    // Arrange
    const libraryRegistration = registerStrudelSoundLibrary

    // Act
    const soundLibrary = await libraryRegistration()

    // Assert
    expect(mockBankAliasLoader).toHaveBeenCalledWith(ALIAS_LIST)
    const lastBankOrder = Math.max(...mockSampleBankLoader.mock.invocationCallOrder)
    const aliasOrder = mockBankAliasLoader.mock.invocationCallOrder[0] ?? 0
    expect(lastBankOrder).toBeLessThan(aliasOrder)
    expect(soundLibrary).toEqual(SOUND_LIBRARY)
  })

  it('still registers every other bank when one list fails to download', async () => {
    // Arrange
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.endsWith('vcsl.json') ? new Response('', { status: 500 }) : fetchBankList(url)
      )
    )

    // Act
    await registerStrudelSoundLibrary()

    // Assert
    expect(mockSampleBankLoader).toHaveBeenCalledTimes(STRUDEL_SAMPLE_BANKS.length - 1)
    expect(mockBankAliasLoader).toHaveBeenCalledTimes(1)
  })
})

describe('readStrudelDrumMachines', () => {
  it('keys each machine by the lower-case id its sounds use, with its first short name', () => {
    // Arrange
    const aliasList = ALIAS_LIST

    // Act
    const drumMachines = readStrudelDrumMachines(aliasList)

    // Assert
    expect(drumMachines).toEqual({
      rolandtr909: { name: 'RolandTR909', alias: 'TR909' },
      akailinn: { name: 'AkaiLinn', alias: 'Linn' }
    })
  })
})

describe('toStrudelSoundEntries', () => {
  it('names and groups each sound once, dropping aliases, _base and inputs, in list order', () => {
    // Arrange
    const drumMachineKick = {
      data: { type: 'sample', tag: 'drum-machines', baseUrl: DRUM_MACHINES_BASE, samples: ['a'] }
    }
    const soundDictionary = {
      rolandtr909_bd: drumMachineKick,
      tr909_bd: drumMachineKick,
      '808bd': { data: { type: 'sample', baseUrl: DIRT_SAMPLES_BASE, samples: ['a', 'b'] } },
      gm_acoustic_bass: { data: { type: 'soundfont', fonts: ['0320_JCLive_sf2_file'] } },
      gm_piano: { data: { type: 'soundfont', fonts: ['0000_JCLive_sf2_file'] } },
      sawtooth: { data: { type: 'synth' } },
      bus: { data: { type: 'input' } },
      _base: { data: { type: 'sample', baseUrl: DIRT_SAMPLES_BASE, samples: 'https://x/' } }
    }

    // Act
    const soundEntries = toStrudelSoundEntries(soundDictionary, SOUND_LIBRARY)

    // Assert
    expect(soundEntries.map(({ name, label, group }) => [group, label, name])).toEqual([
      ['Dirt samples', '808 bass drum', '808bd'],
      ['Roland TR909', 'Bass drum', 'rolandtr909_bd'],
      ['Synths', 'Sawtooth', 'sawtooth'],
      ['Pianos', 'Piano', 'gm_piano'],
      ['Basses', 'Acoustic bass', 'gm_acoustic_bass']
    ])
    expect(soundEntries[0]?.sampleCount).toBe(2)
  })

  it('returns nothing for a sound map that is not an object', () => {
    // Arrange
    const soundDictionary = undefined

    // Act
    const soundEntries = toStrudelSoundEntries(soundDictionary, SOUND_LIBRARY)

    // Assert
    expect(soundEntries).toEqual([])
  })
})

describe('groupStrudelSoundEntries', () => {
  it('gathers consecutive sounds under their heading, keeping the list order', () => {
    // Arrange
    const kick = buildSoundEntry({ name: 'bd' })
    const snare = buildSoundEntry({ name: 'sd', label: 'Snare drum' })
    const machineKick = buildSoundEntry({ name: 'rolandtr909_bd', group: 'Roland TR909' })

    // Act
    const soundGroups = groupStrudelSoundEntries([kick, snare, machineKick])

    // Assert
    expect(soundGroups).toEqual([
      { label: 'Dirt samples', sounds: [kick, snare] },
      { label: 'Roland TR909', sounds: [machineKick] }
    ])
  })
})

describe('matchesStrudelSoundFilter', () => {
  const dirtSample = buildSoundEntry({ name: 'bd' })
  const drumMachine = buildSoundEntry({ name: 'rolandtr909_bd', tag: 'drum-machines' })
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
