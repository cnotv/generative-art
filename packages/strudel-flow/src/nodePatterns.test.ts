import { describe, expect, it } from 'vitest'
import { createStrudelFlowDrumRow } from './nodeDefaults'
import {
  formatStrudelFlowKnobValue,
  formatStrudelFlowNumber,
  generateStrudelFlowNodePattern
} from './nodePatterns'
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

describe('formatStrudelFlowKnobValue', () => {
  it.each([
    [1650, '1.65k'],
    [20000, '20.0k'],
    [440, '440'],
    [12.34, '12.3'],
    [1, '1.0'],
    [0.25, '0.25'],
    [0.5, '0.5'],
    [Number.NaN, '0.0']
  ])('writes %s as %s', (value, expected) => {
    // Arrange / Act
    const label = formatStrudelFlowKnobValue(value)

    // Assert
    expect(label).toBe(expected)
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
      chordNotes: [[], []]
    }
    const silentBeats = {
      kind: 'beats' as const,
      steps: 16,
      rows: [createStrudelFlowDrumRow('bd')],
      showModifiers: false
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

  it('writes a pad arpeggio and a chord progression', () => {
    // Arrange
    const pad = defaultPad({ steps: 2, grid: makePadGrid({ 0: [0, 2], 1: [4] }) })
    const chords = {
      kind: 'chords' as const,
      key: 'D',
      octave: 4,
      scaleType: 'minor' as const,
      chordProgression: [0, 5]
    }

    // Act
    const padPattern = generateStrudelFlowNodePattern(pad, '')
    const chordsPattern = generateStrudelFlowNodePattern(chords, '')

    // Assert
    expect(padPattern).toBe('n("[0 2] [4]").scale("C3:major")')
    expect(chordsPattern).toBe('n("<[0,2,4] [5,7,9]>").scale("D4:minor")')
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
    expect(pattern).toBe('n("[0, 2, 4]*2 [7] [1]!3").scale("C3:major")')
  })

  it('writes hand-edited chord tones instead of a generated triad', () => {
    // Arrange
    const chords = {
      kind: 'chords' as const,
      key: 'C',
      octave: 4,
      scaleType: 'major' as const,
      chordProgression: [0],
      chordNotes: [[0, 3, 7]]
    }

    // Act
    const pattern = generateStrudelFlowNodePattern(chords, '')

    // Assert
    expect(pattern).toBe('n("<[0,3,7]>").scale("C4:major")')
  })

  it('writes each track as a sample line over its steps, stacked when there are several', () => {
    // Arrange
    const onlyClap = {
      kind: 'beats' as const,
      steps: 4,
      rows: [{ ...createStrudelFlowDrumRow('cp', [1, 3]), modifiers: { 3: '*2' } }],
      showModifiers: true
    }
    const clapAndKick = {
      ...onlyClap,
      rows: [...onlyClap.rows, createStrudelFlowDrumRow('bd', [0, 2, 12])]
    }

    // Act
    const oneTrack = generateStrudelFlowNodePattern(onlyClap, '')
    const twoTracks = generateStrudelFlowNodePattern(clapAndKick, '')

    // Assert
    expect(oneTrack).toBe('s("~ cp ~ cp*2")')
    expect(twoTracks).toBe('stack(s("~ cp ~ cp*2"), s("bd ~ bd ~"))')
  })

  it('wraps a custom expression and drops a trailing semicolon', () => {
    // Arrange
    const code = { kind: 'code' as const, code: 'n("0 2 4").scale("C3:major");' }

    // Act
    const pattern = generateStrudelFlowNodePattern(code, '')

    // Assert
    expect(pattern).toBe('(n("0 2 4").scale("C3:major"))')
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
    [
      'inline visualizer',
      {
        kind: 'visualizer' as const,
        visual: 'punchcard' as const,
        placement: 'inline' as const,
        options: ''
      },
      '._punchcard()'
    ],
    [
      'background visualizer',
      {
        kind: 'visualizer' as const,
        visual: 'spiral' as const,
        placement: 'background' as const,
        options: '{ steady: .96 }'
      },
      '.spiral({ steady: .96 })'
    ]
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

  it("chains a node's own calls after its pattern, skipping calls with no name", () => {
    // Arrange
    const data = {
      kind: 'filter' as const,
      cutoff: 800,
      resonance: 1,
      calls: [
        { method: 'mask', argument: '"1 0"' },
        { method: ' ', argument: '2' },
        { method: 'jux', argument: 'rev' }
      ]
    }

    // Act
    const pattern = generateStrudelFlowNodePattern(data, 's("bd")')
    const patternWithoutInput = generateStrudelFlowNodePattern(data, '')

    // Assert
    expect(pattern).toBe('s("bd").lpf(800).lpq(1).mask("1 0").jux(rev)')
    expect(patternWithoutInput).toBe('')
  })
})
