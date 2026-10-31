import { describe, it, expect } from 'vitest'
import {
  ELECTRO_TUNES,
  STRUDEL_SAMPLE_BANKS,
  DEFAULT_STRUDEL_EXAMPLE_ID,
  STRUDEL_EXAMPLES,
  STRUDEL_LICENSE_NOTE,
  STRUDEL_MUSIC_STYLES
} from './config'

describe('StrudelEditor config', () => {
  it('ships at least one example pattern', () => {
    // Arrange
    const exampleCount = STRUDEL_EXAMPLES.length

    // Act
    const hasExamples = exampleCount > 0

    // Assert
    expect(hasExamples).toBe(true)
  })

  it.each(STRUDEL_EXAMPLES.map((example) => [example.id, example.label, example.code]))(
    'example "%s" has a label and playable code',
    (_id, label, code) => {
      // Arrange
      const labelText = label as string
      const patternCode = code as string

      // Act
      const hasLabel = labelText.length > 0
      const hasCode = patternCode.length > 0

      // Assert
      expect(hasLabel).toBe(true)
      expect(hasCode).toBe(true)
    }
  )

  it('keeps every example id unique', () => {
    // Arrange
    const exampleIds = STRUDEL_EXAMPLES.map((example) => example.id)

    // Act
    const uniqueIds = new Set(exampleIds)

    // Assert
    expect(uniqueIds.size).toBe(exampleIds.length)
  })

  it('gives every example and tune its own id, since each id is its anchor', () => {
    // Arrange
    const patternIds = [...STRUDEL_EXAMPLES, ...ELECTRO_TUNES].map((pattern) => pattern.id)

    // Act
    const uniqueIds = new Set(patternIds)

    // Assert
    expect(uniqueIds.size).toBe(patternIds.length)
  })

  it('points the default at a shipped example', () => {
    // Arrange
    const defaultId = DEFAULT_STRUDEL_EXAMPLE_ID

    // Act
    const matchesDefault = STRUDEL_EXAMPLES.some((example) => example.id === defaultId)

    // Assert
    expect(matchesDefault).toBe(true)
  })

  it('carries the AGPL isolation note for the deployed build', () => {
    // Arrange
    const licenseNote = STRUDEL_LICENSE_NOTE

    // Act
    const mentionsLicense = licenseNote.includes('AGPL-3.0')

    // Assert
    expect(mentionsLicense).toBe(true)
  })

  it('registers dirt-samples last, so the names it shares stay the kit the examples play', () => {
    // Arrange
    const sampleBanks = STRUDEL_SAMPLE_BANKS

    // Act
    const lastBank = sampleBanks.at(-1)

    // Assert
    expect(lastBank?.manifestUrl).toBe(
      'https://raw.githubusercontent.com/tidalcycles/dirt-samples/main/strudel.json'
    )
  })
})

// G1, 49 Hz: lower than this, a phone or laptop plays little but the harmonics.
const LOWEST_BASS_MIDI_NOTE = 31
const NOTE_SEMITONES: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }
const FLAT_OR_SHARP_SEMITONES: Record<string, number> = { b: -1, '#': 1, '': 0 }

const instrumentSnippets = STRUDEL_MUSIC_STYLES.flatMap((style) =>
  style.instruments.map(({ role, snippet }) => ({ styleId: style.id, role, snippet }))
)
const snippetsOfRole = (role: string) =>
  instrumentSnippets.filter((instrument) => instrument.role === role)
const snippetOf = (styleId: string, role: string): string =>
  instrumentSnippets.find(
    (instrument) => instrument.styleId === styleId && instrument.role === role
  )?.snippet ?? ''

const midiNotesOf = (snippet: string): number[] =>
  [...snippet.matchAll(/\b([a-g])([#b]?)(\d)\b/g)].map(
    ([, letter, accidental, octave]) =>
      (Number(octave) + 1) * 12 + NOTE_SEMITONES[letter] + FLAT_OR_SHARP_SEMITONES[accidental]
  )

const stepsPlaying = (snippet: string, soundName: string): number[] =>
  (/s\("([^"]+)"\)/.exec(snippet)?.[1] ?? '')
    .split(' ')
    .flatMap((token, step) => (token === soundName ? [step] : []))

describe('STRUDEL_MUSIC_STYLES snippets', () => {
  it.each([
    { styleId: 'drum-and-bass', expectedKickSteps: [0, 5] },
    { styleId: 'hip-hop', expectedKickSteps: [0, 3, 5] }
  ])('keeps the $styleId kick off the snare', ({ styleId, expectedKickSteps }) => {
    // Arrange
    const kickSteps = stepsPlaying(snippetOf(styleId, 'kick'), 'bd')
    const snareSteps = stepsPlaying(snippetOf(styleId, 'snare'), 'sd')

    // Act
    const sharedSteps = kickSteps.filter((step) => snareSteps.includes(step))

    // Assert
    expect(kickSteps).toEqual(expectedKickSteps)
    expect(sharedSteps).toEqual([])
  })

  it.each(snippetsOfRole('bass'))(
    '$styleId bass stays high enough for small speakers to carry',
    ({ snippet }) => {
      // Arrange
      const notes = midiNotesOf(snippet)

      // Act
      const lowestNote = Math.min(...notes)

      // Assert
      expect(lowestNote).toBeGreaterThanOrEqual(LOWEST_BASS_MIDI_NOTE)
    }
  )

  it.each(snippetsOfRole('bass').filter(({ snippet }) => snippet.includes('s("sine")')))(
    '$styleId sine bass is saturated, as a filter on a sine has nothing to remove',
    ({ snippet }) => {
      // Arrange
      const sineSnippet = snippet

      // Act
      const isFiltered = sineSnippet.includes('.lpf(')
      const isSaturated = sineSnippet.includes('.shape(')

      // Assert
      expect(isFiltered).toBe(false)
      expect(isSaturated).toBe(true)
    }
  )

  it.each(instrumentSnippets.filter(({ snippet }) => snippet.includes('s("sawtooth")')))(
    '$styleId $role ends each note rather than holding through the next hit',
    ({ snippet }) => {
      // Arrange
      const sawtoothSnippet = snippet

      // Act
      const endsEachNote =
        sawtoothSnippet.includes('.decay(') && sawtoothSnippet.includes('.sustain(0)')

      // Assert
      expect(endsEachNote).toBe(true)
    }
  )

  it.each(snippetsOfRole('hihat'))(
    '$styleId hi-hats are not turned down, as the dirt-samples hat is already quiet',
    ({ snippet }) => {
      // Arrange
      const gainText = /\.gain\(([\d.]+)\)/.exec(snippet)?.[1] ?? '1'

      // Act
      const hatGain = Number(gainText)

      // Assert
      expect(hatGain).toBeGreaterThanOrEqual(1)
    }
  )

  it.each(snippetsOfRole('percussion'))(
    "$styleId percussion is filtered out of the kick's band",
    ({ snippet }) => {
      // Arrange
      const percussionSnippet = snippet

      // Act
      const isFiltered = percussionSnippet.includes('.hpf(')

      // Assert
      expect(isFiltered).toBe(true)
    }
  )

  it('keeps the hip hop bass on the notes of its chords', () => {
    // Arrange
    const chordNotesInOrder = [
      ['c', 'eb', 'g', 'bb'],
      ['ab', 'c', 'eb', 'g']
    ]
    const bassBars =
      /note\("<\[(.+)] \[(.+)]>"\)/.exec(snippetOf('hip-hop', 'bass'))?.slice(1) ?? []

    // Act
    const strayNotes = bassBars.flatMap((bar, barIndex) =>
      [...bar.matchAll(/([a-g]b?)\d/g)]
        .map(([, noteName]) => noteName)
        .filter((noteName) => !chordNotesInOrder[barIndex].includes(noteName))
    )

    // Assert
    expect(bassBars).toHaveLength(2)
    expect(strayNotes).toEqual([])
  })
})

const ADDED_STYLE_IDS = ['synthwave', 'stoner-rock', 'grunge', 'classical', 'funk', 'jazz'] as const

describe('the added styles', () => {
  it.each(ADDED_STYLE_IDS)('ships a %s style', (styleId) => {
    // Arrange
    const styleIds = STRUDEL_MUSIC_STYLES.map((style) => style.id)

    // Act
    const hasStyle = styleIds.includes(styleId)

    // Assert
    expect(hasStyle).toBe(true)
  })
})
