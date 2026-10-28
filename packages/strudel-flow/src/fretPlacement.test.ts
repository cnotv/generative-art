import { describe, expect, it } from 'vitest'
import { STRUDEL_FLOW_CHORD_FRET_SPAN, STRUDEL_FLOW_OPEN_STRINGS } from './config'
import { placeStrudelFlowFrets } from './fretPlacement'
import type { StrudelFlowFretPosition } from './types'

const soundedNotes = (positions: StrudelFlowFretPosition[], openStrings: number[]): number[] =>
  positions.map((position) => openStrings[position.lineIndex] + position.fret).toSorted()

describe('placeStrudelFlowFrets', () => {
  it('plays an open string note on the open string', () => {
    // Arrange
    const chords = [[28]]

    // Act
    const positions = placeStrudelFlowFrets(chords, STRUDEL_FLOW_OPEN_STRINGS.bass)

    // Assert
    expect(positions).toEqual([[{ lineIndex: 3, fret: 0 }]])
  })

  it('stays near the previous note rather than dropping to the lowest fret', () => {
    // Arrange: the first note only fits at the top of the neck
    const chords = [[67], [62]]

    // Act
    const positions = placeStrudelFlowFrets(chords, STRUDEL_FLOW_OPEN_STRINGS.bass)

    // Assert
    expect(positions).toEqual([[{ lineIndex: 0, fret: 24 }], [{ lineIndex: 1, fret: 24 }]])
  })

  it('never places a note above fret 24 and leaves out one it cannot reach', () => {
    // Arrange
    const chords = [[68], [20]]

    // Act
    const positions = placeStrudelFlowFrets(chords, STRUDEL_FLOW_OPEN_STRINGS.bass)

    // Assert
    expect(positions).toEqual([[], []])
  })

  it.each([
    ['an E power chord', [40, 47, 52]],
    ['an open G major', [43, 47, 50, 55, 59, 67]],
    ['a high A minor triad', [69, 72, 76]]
  ])('keeps %s on separate strings within four frets', (_name, chord) => {
    // Arrange
    const openStrings = STRUDEL_FLOW_OPEN_STRINGS.guitar

    // Act
    const [positions] = placeStrudelFlowFrets([chord], openStrings)

    // Assert
    const fretted = positions.filter((position) => position.fret > 0).map((p) => p.fret)
    expect(soundedNotes(positions, openStrings)).toEqual(chord.toSorted())
    expect(new Set(positions.map((position) => position.lineIndex)).size).toBe(chord.length)
    expect(Math.max(0, ...fretted) - Math.min(...fretted, Infinity)).toBeLessThanOrEqual(
      STRUDEL_FLOW_CHORD_FRET_SPAN
    )
  })
})
