import { describe, expect, it } from 'vitest'
import {
  STONER_GUITAR_DEFAULT_TONE,
  STONER_GUITAR_DURATION_SECONDS,
  STONER_GUITAR_NOTES,
  STONER_GUITAR_PEAK,
  STONER_GUITAR_SAMPLE_RATE,
  STONER_GUITAR_SOUND_NAMES
} from './config'
import { readPeak } from './signal'
import {
  buildStonerGuitarBank,
  listStonerGuitarBankEntries,
  readNoteFrequency,
  renderStonerGuitarSample
} from './stonerGuitar'
import type { StonerGuitarArticulation } from './types'

const ARTICULATIONS: StonerGuitarArticulation[] = ['chord', 'mute', 'note']

describe('readNoteFrequency', () => {
  it.each([
    ['a4', 440],
    ['c4', 261.63],
    ['c2', 65.41],
    ['ds2', 77.78],
    ['bb2', 116.54]
  ])('reads %s as %f Hz', (noteName, expectedFrequency) => {
    // Arrange
    const name = noteName

    // Act
    const frequency = readNoteFrequency(name)

    // Assert
    expect(frequency).toBeCloseTo(expectedFrequency, 1)
  })
})

describe('renderStonerGuitarSample', () => {
  it.each(ARTICULATIONS)(
    'renders a clean %s: silent ends, -1 dBFS, two different channels',
    (articulation) => {
      // Arrange
      const tone = STONER_GUITAR_DEFAULT_TONE

      // Act
      const channels = renderStonerGuitarSample('a2', articulation, tone, 5)

      // Assert
      const [left, right] = channels
      expect(channels).toHaveLength(2)
      expect(left?.length).toBe(
        Math.round(STONER_GUITAR_SAMPLE_RATE * STONER_GUITAR_DURATION_SECONDS[articulation])
      )
      const edgeSamples = [left?.at(0), left?.at(-1), right?.at(0), right?.at(-1)].map((sample) =>
        Math.abs(sample ?? 1)
      )
      expect(edgeSamples).toEqual([0, 0, 0, 0])
      expect(readPeak(...channels)).toBeCloseTo(STONER_GUITAR_PEAK, 3)
      expect([...(left ?? [])]).not.toEqual([...(right ?? [])])
    }
  )
})

describe('the bank', () => {
  it('lists every sound name with every sampled note', () => {
    // Arrange
    const expectedCount = ARTICULATIONS.reduce(
      (total, articulation) => total + STONER_GUITAR_NOTES[articulation].length,
      0
    )

    // Act
    const entries = listStonerGuitarBankEntries()

    // Assert
    expect(entries).toHaveLength(expectedCount)
    ARTICULATIONS.forEach((articulation) =>
      expect(
        entries
          .filter((entry) => entry.soundName === STONER_GUITAR_SOUND_NAMES[articulation])
          .map((entry) => entry.noteName)
      ).toEqual(STONER_GUITAR_NOTES[articulation])
    )
  })

  it('renders audio for every entry', () => {
    // Arrange
    const entries = listStonerGuitarBankEntries()

    // Act
    const bank = buildStonerGuitarBank(STONER_GUITAR_DEFAULT_TONE)

    // Assert
    expect(bank.map(({ soundName, noteName }) => `${soundName}:${noteName}`)).toEqual(
      entries.map(({ soundName, noteName }) => `${soundName}:${noteName}`)
    )
    expect(bank.every(({ channels }) => channels.length === 2 && readPeak(...channels) > 0.8)).toBe(
      true
    )
  }, 120000)
})
