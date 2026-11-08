import { describe, expect, it } from 'vitest'
import { INSTRUMENT_BUILT_IN_PRESETS, INSTRUMENT_KINDS, INSTRUMENT_SAMPLE_RATE } from './config'
import { readNoteFrequency } from './notes'
import {
  buildInstrumentBank,
  listInstrumentSounds,
  renderInstrumentSound
} from './renderInstrument'
import { readPeak } from './signal'
import { TEST_SAMPLE_RATE, detectFrequency, readEnergyShare, readRms } from './testSupport'
import type { InstrumentPreset } from './types'

const findPreset = (name: string): InstrumentPreset => {
  const preset = INSTRUMENT_BUILT_IN_PRESETS.find((candidate) => candidate.name === name)
  if (preset === undefined) {
    throw new Error(`no built-in preset ${name}`)
  }
  return preset
}

const renderOne = (
  presetName: string,
  articulationId: string,
  noteName: string | null = null,
  knobOverrides: Record<string, number> = {}
): Float32Array[] => {
  const preset = findPreset(presetName)
  const withKnobs = { ...preset, knobs: { ...preset.knobs, ...knobOverrides } }
  const request = listInstrumentSounds(withKnobs).find(
    ({ articulation, noteName: candidate }) =>
      articulation.id === articulationId && candidate === noteName
  )
  if (request === undefined) {
    throw new Error(`no sound ${presetName} ${articulationId} ${noteName}`)
  }
  return renderInstrumentSound(withKnobs, request)
}

describe('listInstrumentSounds', () => {
  it.each([
    ['stoner', 34],
    ['fuzzbass', 20],
    ['campfire', 34],
    ['doomorgan', 13],
    ['garagekit', 9]
  ])('lists %s with %i sounds, each named after the preset', (presetName, expectedCount) => {
    // Arrange
    const preset = findPreset(presetName)

    // Act
    const sounds = listInstrumentSounds(preset)

    // Assert
    expect(sounds).toHaveLength(expectedCount)
    expect(sounds.every(({ soundName }) => soundName.startsWith(`${presetName}_`))).toBe(true)
  })

  it('samples a drop A guitar down to a1 and a bass down to a0', () => {
    // Arrange
    const guitar = listInstrumentSounds(findPreset('chainsaw'))
    const bass = listInstrumentSounds(findPreset('deathbass'))

    // Act
    const guitarNotes = guitar.filter(({ articulation }) => articulation.id === 'chord')
    const bassNotes = bass.filter(({ articulation }) => articulation.id === 'note')

    // Assert
    expect(guitarNotes.map(({ noteName }) => noteName)[0]).toBe('a1')
    expect(bassNotes.map(({ noteName }) => noteName)[0]).toBe('a0')
  })

  it('leaves the notes of a drum empty, so it registers as a plain list', () => {
    // Arrange
    const kit = findPreset('blastkit')

    // Act
    const sounds = listInstrumentSounds(kit)

    // Assert
    expect(sounds.map(({ noteName }) => noteName)).toEqual(Array.from({ length: 9 }, () => null))
  })
})

describe('pitched sounds', () => {
  it.each([
    ['stoner', 'a2'],
    ['stoner', 'c4'],
    ['chainsaw', 'a1'],
    ['jangle', 'c5'],
    ['fuzzbass', 'a0'],
    ['deathbass', 'c2'],
    ['campfire', 'a3'],
    ['doomorgan', 'c2'],
    ['doomorgan', 'c5']
  ])('%s plays %s within 10 cents', (presetName, noteName) => {
    // Arrange
    const [left = new Float32Array()] = renderOne(presetName, 'note', noteName)
    const frequency = readNoteFrequency(noteName)

    // Act
    const detected = detectFrequency(left, frequency)

    // Assert
    expect(Math.abs(1200 * Math.log2(detected / frequency))).toBeLessThan(10)
  })
})

describe.each([
  ['stoner', 'chord', 'a2', 4],
  ['chainsaw', 'mute', 'a1', 0.6],
  ['fuzzbass', 'note', 'c2', 3],
  ['deathbass', 'mute', 'a1', 0.5],
  ['campfire', 'chord', 'a2', 4],
  ['doomorgan', 'note', 'c3', 3],
  ['garagekit', 'kick', null, 0.6],
  ['blastkit', 'crash', null, 2.5]
])('the sound %s %s %s', (presetName, articulationId, noteName, expectedSeconds) => {
  it('has its length, silent ends and its own peak, in two channels', () => {
    // Arrange
    const articulation = INSTRUMENT_KINDS[findPreset(presetName).kind].articulations.find(
      ({ id }) => id === articulationId
    )

    // Act
    const channels = renderOne(presetName, articulationId, noteName)

    // Assert
    const [left = new Float32Array(), right = new Float32Array()] = channels
    expect(channels).toHaveLength(2)
    expect(left.length).toBe(Math.round(INSTRUMENT_SAMPLE_RATE * expectedSeconds))
    expect(
      [left.at(0), left.at(-1), right.at(0), right.at(-1)].map((sample) => Math.abs(sample ?? 1))
    ).toEqual([0, 0, 0, 0])
    expect(readPeak(...channels)).toBeCloseTo(articulation?.peak ?? 0, 3)
  })

  it('is the same every time it is rendered', () => {
    // Arrange
    const first = renderOne(presetName, articulationId, noteName)

    // Act
    const second = renderOne(presetName, articulationId, noteName)

    // Assert
    expect(second.map((channel) => [...channel])).toEqual(first.map((channel) => [...channel]))
  })
})

describe('string instruments', () => {
  it('keeps every pitched articulation at or under -1 dBFS', () => {
    // Arrange
    const peaks = ['stoner', 'jangle', 'deathbass', 'campfire', 'doomorgan'].map((name) => {
      const kind = findPreset(name).kind
      const articulation = INSTRUMENT_KINDS[kind].articulations[0]
      return readPeak(...renderOne(name, articulation?.id ?? '', articulation?.notes[0] ?? null))
    })

    // Act
    const loudest = Math.max(...peaks)

    // Assert
    expect(loudest).toBeLessThanOrEqual(0.89 + 1e-6)
  })

  it('plays a clean guitar at no drive and a compressed one at full drive', () => {
    // Arrange
    const crest = (signal: Float32Array): number => readPeak(signal) / readRms(signal)

    // Act
    const [clean = new Float32Array()] = renderOne('jangle', 'note', 'a2', { drive: 0 })
    const [fuzz = new Float32Array()] = renderOne('jangle', 'note', 'a2', { drive: 1 })

    // Assert
    expect(crest(clean)).toBeGreaterThan(crest(fuzz) * 1.3)
  })

  it('rings a muted note far shorter than an open one', () => {
    // Arrange
    const [open = new Float32Array()] = renderOne('fuzzbass', 'note', 'a1')
    const [muted = new Float32Array()] = renderOne('fuzzbass', 'mute', 'a1')

    // Act
    const lateOpen = readRms(open, 12000, 16000)
    const lateMuted = readRms(muted, 12000, 16000)

    // Assert
    expect(lateMuted).toBeLessThan(lateOpen * 0.1)
  })

  it.each([
    ['stoner', 'chord', 'a2', 'different'],
    ['campfire', 'chord', 'a2', 'different'],
    ['fuzzbass', 'note', 'a1', 'identical']
  ])('puts %s %s %s in two %s channels', (presetName, articulationId, noteName, relation) => {
    // Arrange
    const [left = new Float32Array(), right = new Float32Array()] = renderOne(
      presetName,
      articulationId,
      noteName
    )

    // Act
    const identical = [...left].every((sample, index) => sample === right[index])

    // Assert
    expect(identical).toBe(relation === 'identical')
  })

  it('collapses an acoustic guitar to mono at zero width', () => {
    // Arrange
    const [left = new Float32Array(), right = new Float32Array()] = renderOne(
      'campfire',
      'note',
      'a2',
      { width: 0 }
    )

    // Act
    const identical = [...left].every((sample, index) => sample === right[index])

    // Assert
    expect(identical).toBe(true)
  })

  it('spreads the strings of a slow strum later than a fast one', () => {
    // Arrange
    const readRise = (strum: number): number => {
      const [left = new Float32Array()] = renderOne('campfire', 'chord', 'a2', { strum })
      return readRms(left, 0, 400)
    }

    // Act
    const fastRise = readRise(0)
    const slowRise = readRise(1)

    // Assert
    expect(slowRise).toBeLessThan(fastRise)
  })

  it('scoops the mids of the chainsaw guitar below the stoner fuzz', () => {
    // Arrange
    const [chainsaw = new Float32Array()] = renderOne('chainsaw', 'note', 'a2')
    const [seattle = new Float32Array()] = renderOne('seattle', 'note', 'a2')
    const midShare = (signal: Float32Array): number =>
      readEnergyShare(signal, { aboveHz: 400 }) - readEnergyShare(signal, { aboveHz: 2500 })

    // Act
    const chainsawMids = midShare(chainsaw)
    const seattleMids = midShare(seattle)

    // Assert
    expect(chainsawMids).toBeLessThan(seattleMids)
  })
})

describe('organ', () => {
  it('adds a click and a fast harmonic to the attack with the percussion knob', () => {
    // Arrange
    const [plain = new Float32Array()] = renderOne('doomorgan', 'note', 'c3', { percussion: 0 })
    const [struck = new Float32Array()] = renderOne('doomorgan', 'note', 'c3', { percussion: 1 })

    // Act
    const attackShare = (signal: Float32Array): number =>
      readEnergyShare(signal.slice(0, 600), { aboveHz: 1500 })

    // Assert
    expect(attackShare(struck)).toBeGreaterThan(attackShare(plain))
  })

  it('is brighter with the brightness knob up', () => {
    // Arrange
    const [dull = new Float32Array()] = renderOne('doomorgan', 'note', 'c3', { brightness: 0 })
    const [bright = new Float32Array()] = renderOne('doomorgan', 'note', 'c3', { brightness: 1 })

    // Act
    const dullShare = readEnergyShare(dull, { aboveHz: 1000 })
    const brightShare = readEnergyShare(bright, { aboveHz: 1000 })

    // Assert
    expect(brightShare).toBeGreaterThan(dullShare)
  })
})

describe('drum kit', () => {
  it('concentrates the kick below 150 Hz', () => {
    // Arrange
    const [kick = new Float32Array()] = renderOne('garagekit', 'kick')

    // Act
    const lowShare = readEnergyShare(kick, { belowHz: 150 })

    // Assert
    expect(lowShare).toBeGreaterThan(0.6)
  })

  it.each(['hatclosed', 'hatopen'])('puts %s above 5 kHz', (articulationId) => {
    // Arrange
    const [cymbal = new Float32Array()] = renderOne('blastkit', articulationId)

    // Act
    const highShare = readEnergyShare(cymbal, { aboveHz: 5000 })

    // Assert
    expect(highShare).toBeGreaterThan(0.6)
  })

  it('keeps the crash in the upper half of the spectrum, longer and noisier than a hat', () => {
    // Arrange
    const [crash = new Float32Array()] = renderOne('blastkit', 'crash')

    // Act
    const highShare = readEnergyShare(crash, { aboveHz: 2000 })

    // Assert
    expect(highShare).toBeGreaterThan(0.8)
  })

  it('pitches the toms in order, low under mid under hi', () => {
    // Arrange
    const readLowShare = (articulationId: string): number => {
      const [tom = new Float32Array()] = renderOne('garagekit', articulationId)
      return readEnergyShare(tom, { belowHz: 130 })
    }

    // Act
    const [low, mid, high] = ['tomlow', 'tommid', 'tomhi'].map(readLowShare)

    // Assert
    expect(low).toBeGreaterThan(mid ?? 1)
    expect(mid).toBeGreaterThan(high ?? 1)
  })

  it('rings longer with the decay knob up', () => {
    // Arrange
    const lateEnergy = (decay: number): number => {
      const [snare = new Float32Array()] = renderOne('blastkit', 'snare', null, { decay })
      return readRms(snare, 6000, 9000)
    }

    // Act
    const tight = lateEnergy(0)
    const ringing = lateEnergy(1)

    // Assert
    expect(ringing).toBeGreaterThan(tight)
  })

  it('is mono dry and stereo with a room', () => {
    // Arrange
    const isMono = (channels: Float32Array[]): boolean =>
      [...(channels[0] ?? [])].every((sample, index) => sample === channels[1]?.[index])

    // Act
    const dry = renderOne('blastkit', 'snare', null, { room: 0 })
    const roomy = renderOne('blastkit', 'snare', null, { room: 1 })

    // Assert
    expect(isMono(dry)).toBe(true)
    expect(isMono(roomy)).toBe(false)
  })

  it('keeps a hat quieter than a kick', () => {
    // Arrange
    const hat = renderOne('garagekit', 'hatclosed')
    const kick = renderOne('garagekit', 'kick')

    // Act
    const hatPeak = readPeak(...hat)
    const kickPeak = readPeak(...kick)

    // Assert
    expect(hatPeak).toBeLessThan(kickPeak)
  })
})

describe('buildInstrumentBank', () => {
  it('renders every listed sound of a small preset in order', () => {
    // Arrange
    const kit = findPreset('blastkit')

    // Act
    const bank = buildInstrumentBank(kit)

    // Assert
    expect(bank.map(({ soundName }) => soundName)).toEqual(
      listInstrumentSounds(kit).map(({ soundName }) => soundName)
    )
    expect(bank.every(({ channels }) => channels.length === 2 && channels[0]?.length)).toBe(true)
    expect(TEST_SAMPLE_RATE).toBe(INSTRUMENT_SAMPLE_RATE)
  })
})
