import { describe, it, expect } from 'vitest'
import type { DrumSound, TranscriptionBar, TranscriptionResult } from '../types'
import { formatBarSequence, generateStrudelCode } from './generateStrudelCode'

const STEPS_PER_BAR = 16

const createBar = (
  drumsByStep: Record<number, DrumSound[]>,
  bassByStep: Record<number, string>,
  chord: string | null
): TranscriptionBar => ({
  steps: Array.from({ length: STEPS_PER_BAR }, (_, stepIndex) => ({
    drums: drumsByStep[stepIndex] ?? [],
    bassNote: bassByStep[stepIndex] ?? null
  })),
  chord
})

const FOUR_ON_THE_FLOOR = createBar(
  { 0: ['bd'], 2: ['hh'], 4: ['bd', 'hh'], 8: ['bd'], 12: ['bd'] },
  { 0: 'a1', 8: 'c2' },
  'Am'
)

describe('formatBarSequence', () => {
  it.each([
    ['one repeating bar', ['bd ~', 'bd ~', 'bd ~'], 'bd ~'],
    ['a two-bar loop', ['bd ~', 'sd ~', 'bd ~', 'sd ~'], '<[bd ~] [sd ~]>'],
    ['consecutive repeats', ['bd ~', 'bd ~', 'sd ~'], '<[bd ~]!2 [sd ~]>'],
    ['single tokens', ['Am', 'Am', 'C', 'G'], '<Am!2 C G>'],
    ['nothing at all', [], '~']
  ])('collapses %s', (_label, barStrings, expectedSequence) => {
    // Arrange
    const bars = barStrings

    // Act
    const sequence = formatBarSequence(bars)

    // Assert
    expect(sequence).toBe(expectedSequence)
  })
})

describe('generateStrudelCode', () => {
  it('writes tempo, drums, bass and chords as one stack', () => {
    // Arrange
    const result: TranscriptionResult = {
      beatsPerMinute: 124,
      bars: [FOUR_ON_THE_FLOOR, FOUR_ON_THE_FLOOR]
    }

    // Act
    const code = generateStrudelCode(result, 'loop.mp3')

    // Assert
    expect(code).toBe(
      [
        '// Transcribed from "loop.mp3": 124 BPM, 2 bars',
        'setcps(124/60/4)',
        '',
        'stack(',
        '  s("bd ~ hh ~ [bd,hh] ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~"),',
        '  note("a1 ~ ~ ~ ~ ~ ~ ~ c2 ~ ~ ~ ~ ~ ~ ~").s("sawtooth").lpf(400).gain(.7),',
        '  chord("Am").voicing().s("triangle").gain(.4)',
        ')'
      ].join('\n')
    )
  })

  it('leaves out layers the audio did not have', () => {
    // Arrange
    const drumsOnly = createBar({ 0: ['bd'] }, {}, null)
    const result: TranscriptionResult = { beatsPerMinute: 90, bars: [drumsOnly] }

    // Act
    const code = generateStrudelCode(result, 'drums.wav')

    // Assert
    expect(code).toContain('s("bd ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~")')
    expect(code).not.toContain('note(')
    expect(code).not.toContain('chord(')
  })

  it('plays silence when nothing was detected', () => {
    // Arrange
    const result: TranscriptionResult = {
      beatsPerMinute: 120,
      bars: [createBar({}, {}, null)]
    }

    // Act
    const code = generateStrudelCode(result, 'quiet.mp3')

    // Assert
    expect(code.endsWith('silence')).toBe(true)
  })

  it('keeps a file name with line breaks inside the comment', () => {
    // Arrange
    const result: TranscriptionResult = { beatsPerMinute: 120, bars: [FOUR_ON_THE_FLOOR] }

    // Act
    const code = generateStrudelCode(result, 'evil\nsetcps(9).mp3')

    // Assert
    expect(code.split('\n')[0]).toBe('// Transcribed from "evil setcps(9).mp3": 120 BPM, 1 bars')
  })
})
