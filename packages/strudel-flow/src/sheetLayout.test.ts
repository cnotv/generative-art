import { describe, expect, it } from 'vitest'
import {
  STRUDEL_FLOW_NOTE_LETTERS,
  STRUDEL_FLOW_SHEET_DOT_FACTOR,
  STRUDEL_FLOW_SHEET_VALUES
} from './config'
import { readStrudelFlowSpelledNote } from './noteValues'
import { layoutStrudelFlowSheet } from './sheetLayout'
import type {
  StrudelFlowNoteBar,
  StrudelFlowSheetChord,
  StrudelFlowSheetLayout,
  StrudelFlowSheetStaff
} from './types'

const SEMITONES = [0, 2, 4, 5, 7, 9, 11]
const ALTERATIONS = { sharp: 1, flat: -1, natural: 0 }
const TRIPLET = 2 / 3

const bar = (...events: [string[], number][]): StrudelFlowNoteBar =>
  events.reduce<StrudelFlowNoteBar>((built, [notes, beats]) => {
    const start = built.reduce((total, event) => total + event.beats, 0)
    return [...built, { notes, start, beats }]
  }, [])

const stepOf = (staff: StrudelFlowSheetStaff, y: number, lineGap: number): number =>
  Math.round((staff.bottomY - y) / (lineGap / 2)) + staff.bottomStep

const chordBeats = (chord: StrudelFlowSheetChord): number => {
  const flags = chord.flags.length
  const value = STRUDEL_FLOW_SHEET_VALUES.find(
    (candidate) =>
      candidate.filled === chord.filled &&
      candidate.stem === (chord.stem !== null) &&
      candidate.flags === flags
  )!.beats
  return (
    value *
    (chord.dots.length > 0 ? STRUDEL_FLOW_SHEET_DOT_FACTOR : 1) *
    (chord.isTriplet ? TRIPLET : 1)
  )
}

const barOf = (layout: StrudelFlowSheetLayout, x: number): number =>
  layout.barEndXs.findIndex((endX) => x < endX)

type Decoded = { bar: number; start: number; beats: number; notes: number[] }

// Reads a layout back the way a player reads the page: pitch from where a head sits on its staff
// and the accidentals written earlier in the bar, length from the head, stem, flags and dot.
const decodeStaff = (layout: StrudelFlowSheetLayout, staffIndex: number): Decoded[] => {
  const staff = layout.staves[staffIndex]
  const marks = [
    ...layout.chords
      .filter((chord) => chord.staffIndex === staffIndex)
      .map((chord) => ({ x: chord.x, chord, beats: chordBeats(chord) })),
    ...layout.rests
      .filter((rest) => rest.staffIndex === staffIndex)
      .map((rest) => ({
        x: rest.x,
        chord: null,
        beats:
          rest.beats *
          (rest.dotted ? STRUDEL_FLOW_SHEET_DOT_FACTOR : 1) *
          (rest.isTriplet ? TRIPLET : 1)
      }))
  ].toSorted((first, second) => first.x - second.x)
  return marks.reduce<{
    decoded: Decoded[]
    time: Map<number, number>
    signs: Map<string, number>
    tied: boolean
  }>(
    (state, mark) => {
      const barIndex = barOf(layout, mark.x)
      const start = state.time.get(barIndex) ?? 0
      const time = new Map(state.time).set(barIndex, start + mark.beats)
      if (mark.chord === null) {
        return { ...state, time, tied: false }
      }
      if (state.tied) {
        const previous = state.decoded.at(-1)!
        return {
          ...state,
          time,
          tied: mark.chord.tiedForward,
          decoded: [
            ...state.decoded.slice(0, -1),
            { ...previous, beats: previous.beats + mark.beats }
          ]
        }
      }
      const signs = new Map(state.signs)
      const notes = mark.chord.heads.map((head) => {
        const step = stepOf(staff, head.y, layout.lineGap)
        const key = `${barIndex}:${step}`
        if (head.accidental !== null) {
          signs.set(key, ALTERATIONS[head.accidental])
        }
        const octave = Math.floor(step / 7)
        return (octave + 1) * 12 + SEMITONES[step % 7] + (signs.get(key) ?? 0)
      })
      return {
        time,
        signs,
        tied: mark.chord.tiedForward,
        decoded: [...state.decoded, { bar: barIndex, start, beats: mark.beats, notes }]
      }
    },
    { decoded: [], time: new Map(), signs: new Map(), tied: false }
  ).decoded
}

const decodeSheet = (layout: StrudelFlowSheetLayout): Decoded[] =>
  layout.staves
    .flatMap((_, staffIndex) => decodeStaff(layout, staffIndex))
    .reduce<Decoded[]>((merged, event) => {
      const same = merged.find(
        (other) =>
          other.bar === event.bar &&
          Math.abs(other.start - event.start) < 1e-6 &&
          Math.abs(other.beats - event.beats) < 1e-6
      )
      return same === undefined
        ? [...merged, event]
        : merged.map((other) =>
            other === same ? { ...other, notes: [...other.notes, ...event.notes] } : other
          )
    }, [])
    .map((event) => ({
      ...event,
      start: Math.round(event.start * 1000) / 1000,
      beats: Math.round(event.beats * 1000) / 1000,
      notes: event.notes.toSorted((first, second) => first - second)
    }))
    .toSorted((first, second) => first.bar - second.bar || first.start - second.start)

const expectedEvents = (bars: StrudelFlowNoteBar[]): Decoded[] =>
  bars.flatMap((events, barIndex) =>
    events.map((event) => ({
      bar: barIndex,
      start: Math.round(event.start * 1000) / 1000,
      beats: Math.round(event.beats * 1000) / 1000,
      notes: event.notes
        .map((note) => readStrudelFlowSpelledNote(note)!.midiNote)
        .toSorted((first, second) => first - second)
    }))
  )

const headSteps = (layout: StrudelFlowSheetLayout) =>
  layout.chords.flatMap((chord) =>
    chord.heads.map((head) => ({
      clef: layout.staves[chord.staffIndex].clef,
      step:
        stepOf(layout.staves[chord.staffIndex], head.y, layout.lineGap) -
        layout.staves[chord.staffIndex].bottomStep,
      ledgers: head.ledgerYs.length
    }))
  )

describe('layoutStrudelFlowSheet pitch placement', () => {
  it.each([
    ['e4 on the treble bottom line', 'e4', 'treble', 0, 0],
    ['f5 on the treble top line', 'f5', 'treble', 8, 0],
    ['middle c on a ledger line below the treble staff', 'c4', 'treble', -2, 1],
    ['a5 on a ledger line above the treble staff', 'a5', 'treble', 10, 1],
    ['c6 two ledger lines up', 'c6', 'treble', 12, 2],
    ['g2 on the bass bottom line', 'g2', 'bass', 0, 0],
    ['a3 on the bass top line', 'a3', 'bass', 8, 0],
    ['e2 on a ledger line below the bass staff', 'e2', 'bass', -2, 1],
    ['b3 just above the bass staff, no ledger', 'b3', 'bass', 9, 0]
  ])('puts %s', (_name, note, clef, step, ledgers) => {
    // Act
    const layout = layoutStrudelFlowSheet([bar([[note], 4])], 4)

    // Assert
    expect(headSteps(layout)).toEqual([{ clef, step, ledgers }])
  })

  it('uses only the treble staff when every note is middle c or higher', () => {
    // Act
    const layout = layoutStrudelFlowSheet([bar([['c4'], 2], [['g5'], 2])], 4)

    // Assert
    expect(layout.staves.map((staff) => staff.clef)).toEqual(['treble'])
  })

  it('uses only the bass staff when every note is below middle c', () => {
    // Act
    const layout = layoutStrudelFlowSheet([bar([['c2'], 2], [['b3'], 2])], 4)

    // Assert
    expect(layout.staves.map((staff) => staff.clef)).toEqual(['bass'])
  })

  it('splits a chord that spans both clefs across a grand staff', () => {
    // Act
    const layout = layoutStrudelFlowSheet([bar([['c3', 'g3', 'e4', 'c5'], 4])], 4)

    // Assert
    expect(layout.staves.map((staff) => staff.clef)).toEqual(['treble', 'bass'])
    expect(
      layout.chords.map((chord) => [layout.staves[chord.staffIndex].clef, chord.heads.length])
    ).toEqual([
      ['treble', 2],
      ['bass', 2]
    ])
  })

  it('rests on the staff that has nothing to play', () => {
    // Act
    const layout = layoutStrudelFlowSheet([bar([['c5'], 2], [['c3'], 2])], 4)

    // Assert
    expect(layout.rests.map((rest) => [layout.staves[rest.staffIndex].clef, rest.beats])).toEqual([
      ['bass', 2],
      ['treble', 2]
    ])
  })
})

describe('layoutStrudelFlowSheet accidentals', () => {
  const accidentalsOf = (layout: StrudelFlowSheetLayout) =>
    layout.chords.flatMap((chord) => chord.heads.map((head) => head.accidental))

  it('writes a sharp once per bar and a natural to cancel it', () => {
    // Act
    const layout = layoutStrudelFlowSheet(
      [bar([['f#4'], 1], [['f#4'], 1], [['f4'], 1], [['eb4'], 1])],
      4
    )

    // Assert
    expect(accidentalsOf(layout)).toEqual(['sharp', null, 'natural', 'flat'])
  })

  it('writes the sharp again in the next bar', () => {
    // Act
    const layout = layoutStrudelFlowSheet([bar([['c#5'], 4]), bar([['c#5'], 4])], 4)

    // Assert
    expect(accidentalsOf(layout)).toEqual(['sharp', 'sharp'])
  })

  it('spells a MIDI number with a sharp', () => {
    // Act
    const layout = layoutStrudelFlowSheet([bar([['61'], 4])], 4)

    // Assert
    expect(accidentalsOf(layout)).toEqual(['sharp'])
    expect(headSteps(layout)[0].step).toBe(-2)
  })

  it('needs no sign on a tied continuation', () => {
    // Act
    const layout = layoutStrudelFlowSheet([bar([['bb4'], 2.5], [['c5'], 1.5])], 4)

    // Assert
    expect(accidentalsOf(layout)).toEqual(['flat', null, null])
  })
})

describe('layoutStrudelFlowSheet note shapes', () => {
  const shapeOf = (chord: StrudelFlowSheetChord) => ({
    filled: chord.filled,
    stem: chord.stem !== null,
    flags: chord.flags.length,
    dotted: chord.dots.length > 0,
    triplet: chord.isTriplet,
    tied: chord.tiedForward
  })

  it.each([
    [
      'a whole note',
      4,
      [{ filled: false, stem: false, flags: 0, dotted: false, triplet: false, tied: false }]
    ],
    [
      'a dotted half',
      3,
      [{ filled: false, stem: true, flags: 0, dotted: true, triplet: false, tied: false }]
    ],
    [
      'a half',
      2,
      [{ filled: false, stem: true, flags: 0, dotted: false, triplet: false, tied: false }]
    ],
    [
      'a dotted quarter',
      1.5,
      [{ filled: true, stem: true, flags: 0, dotted: true, triplet: false, tied: false }]
    ],
    [
      'a quarter',
      1,
      [{ filled: true, stem: true, flags: 0, dotted: false, triplet: false, tied: false }]
    ],
    [
      'an eighth',
      0.5,
      [{ filled: true, stem: true, flags: 1, dotted: false, triplet: false, tied: false }]
    ],
    [
      'a sixteenth',
      0.25,
      [{ filled: true, stem: true, flags: 2, dotted: false, triplet: false, tied: false }]
    ],
    [
      'an eighth triplet',
      1 / 3,
      [{ filled: true, stem: true, flags: 1, dotted: false, triplet: true, tied: false }]
    ],
    [
      'a half tied to an eighth',
      2.5,
      [
        { filled: false, stem: true, flags: 0, dotted: false, triplet: false, tied: true },
        { filled: true, stem: true, flags: 1, dotted: false, triplet: false, tied: false }
      ]
    ]
  ])('draws %s', (_name, beats, shapes) => {
    // Act
    const layout = layoutStrudelFlowSheet([[{ notes: ['g4'], start: 0, beats }]], beats)

    // Assert
    expect(layout.chords.map(shapeOf)).toEqual(shapes)
  })

  it('points the stem down from a note high on the staff', () => {
    // Act
    const layout = layoutStrudelFlowSheet([bar([['d5'], 1], [['g4'], 1])], 2)

    // Assert
    const [high, low] = layout.chords
    expect(high.stem!.y2).toBeGreaterThan(high.stem!.y1)
    expect(low.stem!.y2).toBeLessThan(low.stem!.y1)
  })

  it.each([
    ['a gap of a quarter', [...bar([['c5'], 1]), { notes: ['d5'], start: 2, beats: 2 }], [1]],
    ['the end of a bar that stops after one beat', bar([['c5'], 1]), [3]],
    ['a silent bar', [] as StrudelFlowNoteBar, [4]]
  ])('draws a rest for %s', (_name, events, restBeats) => {
    // Act
    const layout = layoutStrudelFlowSheet([events], 4)

    // Assert
    expect(
      layout.rests.map((rest) => rest.beats * (rest.dotted ? STRUDEL_FLOW_SHEET_DOT_FACTOR : 1))
    ).toEqual(restBeats)
  })
})

describe('sheet round trip', () => {
  it.each([
    [
      'the opening of the sample bass tab',
      [
        bar(
          [['a2'], 1],
          [['a2'], 0.5],
          [['e3'], 1],
          [['e3'], 0.5],
          [['d3'], 1 / 6],
          [['e3'], 1 / 6],
          [['d3'], 1 / 6],
          [['c3'], 0.5]
        ),
        bar([['f2'], 1], [['f2'], 0.5], [['d3'], 1], [['d3'], 0.5], [['c3'], 1]),
        bar([['c2'], 1], [['c2'], 0.5], [['c2'], 0.5], [['g1'], 1], [['g1'], 1])
      ]
    ],
    [
      'a piano part across both clefs with accidentals and chords',
      [
        bar([['c3', 'e4', 'g4'], 1.5], [['f#4'], 0.5], [['bb3', 'd5'], 2]),
        bar([['c#5'], 1 / 3], [['d5'], 1 / 3], [['c5'], 1 / 3], [['a2', 'e3', 'c4'], 3]),
        bar([['g4'], 4])
      ]
    ]
  ])('reads %s back from the page', (_name, bars) => {
    // Act
    const decoded = decodeSheet(layoutStrudelFlowSheet(bars, 4))

    // Assert
    expect(decoded).toEqual(expectedEvents(bars))
  })
})

describe('readStrudelFlowSpelledNote', () => {
  it.each([
    ['c#4', { letter: 'c', alteration: 1, octave: 4, midiNote: 61 }],
    ['eb3', { letter: 'e', alteration: -1, octave: 3, midiNote: 51 }],
    ['a', { letter: 'a', alteration: 0, octave: 3, midiNote: 57 }],
    ['70', { letter: 'a', alteration: 1, octave: 4, midiNote: 70 }]
  ])('spells %s', (note, spelled) => {
    // Act / Assert
    expect(readStrudelFlowSpelledNote(note)).toEqual(spelled)
    expect(STRUDEL_FLOW_NOTE_LETTERS).toContain(spelled.letter)
  })
})
