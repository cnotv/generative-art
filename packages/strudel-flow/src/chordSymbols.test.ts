import { describe, expect, it } from 'vitest'
import { readStrudelFlowChordSymbols, writeStrudelFlowChordSymbols } from './chordSymbols'

describe('chord symbols', () => {
  it('reads a diatonic progression into the key it belongs to', () => {
    expect(readStrudelFlowChordSymbols('<C Am F G>')).toMatchObject({
      kind: 'chords',
      key: 'C',
      scaleType: 'major',
      chordProgression: [0, 5, 3, 4],
      chordSymbols: true
    })
  })

  it('takes the key whose tonic opens the progression', () => {
    expect(readStrudelFlowChordSymbols('<Am F C G>')).toMatchObject({
      key: 'A',
      scaleType: 'minor',
      chordProgression: [0, 5, 2, 6]
    })
  })

  it('keeps a rest as a rest', () => {
    expect(readStrudelFlowChordSymbols('<C ~ G>')?.chordNotes).toEqual([[0, 2, 4], [], [4, 6, 8]])
  })

  it.each(['<Cm7 Fm7>', '<~!2 D5 C5>', 'C Am F G', '<C Eb>', '<~ ~>', '<C>x'])(
    'leaves %s to a Notes node',
    (pattern) => {
      expect(readStrudelFlowChordSymbols(pattern)).toBeNull()
    }
  )

  it('writes the same symbols back', () => {
    const chords = readStrudelFlowChordSymbols('<E F#m ~ D#dim>')
    expect(chords).not.toBeNull()
    expect(writeStrudelFlowChordSymbols(chords!)).toBe('<E F#m ~ D#dim>')
  })
})
