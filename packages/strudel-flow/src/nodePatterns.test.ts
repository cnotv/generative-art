import { describe, expect, it } from 'vitest'
import { formatStrudelFlowNumber, generateStrudelFlowNodePattern } from './nodePatterns'

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
    const silentPad = { kind: 'pad' as const, notes: '   ', sound: 'triangle' }
    const silentBeats = {
      kind: 'beats' as const,
      rows: [{ instrument: 'bd' as const, steps: Array(16).fill(false) as boolean[] }]
    }

    // Act
    const padPattern = generateStrudelFlowNodePattern(silentPad, '')
    const beatsPattern = generateStrudelFlowNodePattern(silentBeats, '')

    // Assert
    expect(padPattern).toBe('')
    expect(beatsPattern).toBe('')
  })

  it('writes a pad and a chord voicing with their chosen synth', () => {
    // Arrange
    const pad = { kind: 'pad' as const, notes: 'c3 e3', sound: 'sine' }
    const chords = {
      kind: 'chords' as const,
      root: 'D',
      chordType: '-7',
      sound: 'square'
    }

    // Act
    const padPattern = generateStrudelFlowNodePattern(pad, '')
    const chordsPattern = generateStrudelFlowNodePattern(chords, '')

    // Assert
    expect(padPattern).toBe('note("c3 e3").sound("sine")')
    expect(chordsPattern).toBe('chord("<D-7>").voicing().sound("square")')
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
    ['space', { kind: 'space' as const, room: 0.4, roomSize: 2 }, '.room(0.4).roomsize(2)']
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
