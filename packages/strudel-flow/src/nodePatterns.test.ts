import { describe, expect, it } from 'vitest'
import { formatStrudelFlowNumber, generateStrudelFlowNodePattern } from './nodePatterns'
import type { StrudelFlowPadData } from './types'

const makePadGrid = (notesByStep: Record<number, number[]> = {}): boolean[][] =>
  Array.from({ length: 16 }, (_, step) =>
    Array.from({ length: 8 }, (_, note) => notesByStep[step]?.includes(note) ?? false)
  )

const defaultPad = (overrides: Partial<StrudelFlowPadData> = {}): StrudelFlowPadData => ({
  kind: 'pad',
  steps: 5,
  mode: 'arp',
  octave: 3,
  key: 'C',
  scaleType: 'major',
  grid: makePadGrid({ 0: [0, 4], 1: [2], 2: [4], 3: [2], 4: [0] }),
  columnModifiers: {},
  sound: 'triangle',
  ...overrides
})

describe('formatStrudelFlowNumber', () => {
  it.each([
    [1200.456, 1200.46],
    [0.004, 0],
    [Number.NaN, 0],
    [Number.POSITIVE_INFINITY, 0]
  ])('writes %s as %s', (value, expectedValue) => {
    // Arrange / Act
    const formattedValue = formatStrudelFlowNumber(value)

    // Assert
    expect(formattedValue).toBe(expectedValue)
  })
})

describe('generateStrudelFlowNodePattern', () => {
  it('returns no pattern for an instrument that is silent', () => {
    // Arrange
    const silentPad = defaultPad({ grid: makePadGrid() })
    const silentChords = {
      kind: 'chords' as const,
      key: 'C',
      octave: 4,
      scaleType: 'major' as const,
      chordProgression: [0, 5],
      chordNotes: [[], []],
      sound: 'sawtooth'
    }
    const silentBeats = {
      kind: 'beats' as const,
      rows: [{ instrument: 'bd' as const, steps: Array(16).fill(false) as boolean[] }]
    }

    // Act
    const padPattern = generateStrudelFlowNodePattern(silentPad, '')
    const chordPattern = generateStrudelFlowNodePattern(silentChords, '')
    const beatsPattern = generateStrudelFlowNodePattern(silentBeats, '')

    // Assert
    expect(padPattern).toBe('')
    expect(chordPattern).toBe('')
    expect(beatsPattern).toBe('')
  })

  it('writes a pad arpeggio and a chord progression with their voice', () => {
    // Arrange
    const pad = defaultPad({ sound: 'sine', steps: 2, grid: makePadGrid({ 0: [0, 2], 1: [4] }) })
    const chords = {
      kind: 'chords' as const,
      key: 'D',
      octave: 4,
      scaleType: 'minor' as const,
      chordProgression: [0, 5],
      sound: 'square'
    }

    // Act
    const padPattern = generateStrudelFlowNodePattern(pad, '')
    const chordsPattern = generateStrudelFlowNodePattern(chords, '')

    // Assert
    expect(padPattern).toBe('n("[0 2] [4]").scale("C3:major").sound("sine")')
    expect(chordsPattern).toBe('n("<[0,2,4] [5,7,9]>").scale("D4:minor").sound("square")')
  })

  it('writes chord mode and step modifiers into a pad pattern', () => {
    // Arrange
    const pad = defaultPad({
      mode: 'chord',
      steps: 3,
      grid: makePadGrid({ 0: [0, 2, 4], 1: [7], 2: [1] }),
      columnModifiers: { 0: '*2', 2: '!3' }
    })

    // Act
    const pattern = generateStrudelFlowNodePattern(pad, '')

    // Assert
    expect(pattern).toBe('n("[0, 2, 4]*2 [7] [1]!3").scale("C3:major").sound("triangle")')
  })

  it('writes hand-edited chord tones instead of a generated triad', () => {
    // Arrange
    const chords = {
      kind: 'chords' as const,
      key: 'C',
      octave: 4,
      scaleType: 'major' as const,
      chordProgression: [0],
      chordNotes: [[0, 3, 7]],
      sound: 'sine'
    }

    // Act
    const pattern = generateStrudelFlowNodePattern(chords, '')

    // Assert
    expect(pattern).toBe('n("<[0,3,7]>").scale("C4:major").sound("sine")')
  })

  it('writes one drum row as a struct and several as a stack', () => {
    // Arrange
    const onlyKick = {
      kind: 'beats' as const,
      rows: [{ instrument: 'bd' as const, steps: [true, ...Array(15).fill(false)] as boolean[] }]
    }
    const kickAndSnare = {
      kind: 'beats' as const,
      rows: [
        ...onlyKick.rows,
        { instrument: 'sd' as const, steps: [false, ...Array(15).fill(true)] as boolean[] }
      ]
    }

    // Act
    const oneRowPattern = generateStrudelFlowNodePattern(onlyKick, '')
    const twoRowPattern = generateStrudelFlowNodePattern(kickAndSnare, '')

    // Assert
    expect(oneRowPattern).toBe('s("bd").struct("1 ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~")')
    expect(twoRowPattern).toContain('stack(')
    expect(twoRowPattern).toContain('s("sd").struct("~ 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1")')
  })

  it('wraps a custom expression and drops a trailing semicolon', () => {
    // Arrange
    const code = { kind: 'code' as const, code: 'n("0 2 4").scale("C3:major");' }

    // Act
    const pattern = generateStrudelFlowNodePattern(code, '')

    // Assert
    expect(pattern).toBe('(\nn("0 2 4").scale("C3:major")\n)')
  })

  it.each([
    [
      'filter',
      { kind: 'filter' as const, cutoff: 1200.456, resonance: 2.5 },
      '.lpf(1200.46).lpq(2.5)'
    ],
    [
      'delay',
      { kind: 'delay' as const, mix: 0.5, time: 0.25, feedback: 0.4 },
      '.delay(0.5).delaytime(0.25).delayfeedback(0.4)'
    ],
    [
      'space',
      {
        kind: 'space' as const,
        room: 0.4,
        roomSize: 2,
        roomFade: 0.5,
        roomLowPass: 10000,
        roomDim: 8000
      },
      '.room(0.4).roomsize(2).roomfade(0.5).roomlp(10000).roomdim(8000)'
    ],
    [
      'level',
      { kind: 'level' as const, gain: 1, pan: 0.5, postgain: 1 },
      '.gain(1).pan(0.5).postgain(1)'
    ],
    [
      'envelope',
      { kind: 'envelope' as const, attack: 0.1, decay: 0.1, sustain: 0.7, release: 0.2 },
      '.attack(0.1).decay(0.1).sustain(0.7).release(0.2)'
    ],
    ['scope', { kind: 'scope' as const, scale: 0.25 }, '.analyze("flow-scope")']
  ])('chains a %s effect onto its input', (_kind, data, expectedSuffix) => {
    // Arrange
    const input = 's("bd")'

    // Act
    const pattern = generateStrudelFlowNodePattern(data, input)
    const patternWithoutInput = generateStrudelFlowNodePattern(data, '')

    // Assert
    expect(pattern).toBe(`${input}${expectedSuffix}`)
    expect(patternWithoutInput).toBe('')
  })
})
