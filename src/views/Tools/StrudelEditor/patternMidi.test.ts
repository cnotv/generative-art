import { describe, expect, it } from 'vitest'
import { Midi } from '@tonejs/midi'
import { buildPatternMidi } from './patternMidi'

const parse = (bytes: Uint8Array): Midi => new Midi(bytes)

describe('buildPatternMidi', () => {
  it('writes named and numbered notes at their cycle times, at the pattern tempo', () => {
    const midi = parse(
      buildPatternMidi(
        [
          { beginCycle: 0, durationCycles: 0.5, value: { note: 'c3', s: 'sawtooth' } },
          { beginCycle: 0.5, durationCycles: 0.5, value: { note: 64, s: 'sawtooth' } }
        ],
        { beginCycle: 0, cyclesPerSecond: 0.5 }
      )
    )

    expect(midi.header.tempos[0].bpm).toBeCloseTo(120)
    const [track] = midi.tracks
    expect(track.name).toBe('sawtooth')
    expect(track.notes.map((note) => note.midi)).toEqual([48, 64])
    expect(track.notes[1].time).toBeCloseTo(1)
    expect(track.notes[1].duration).toBeCloseTo(1)
  })

  it('puts known drum sounds on the General MIDI drum channel', () => {
    const midi = parse(
      buildPatternMidi(
        [
          { beginCycle: 0, durationCycles: 0.25, value: { s: 'bd' } },
          { beginCycle: 0.25, durationCycles: 0.25, value: { s: 'hh' } },
          { beginCycle: 0.5, durationCycles: 0.25, value: { s: 'unknown_sample' } }
        ],
        { beginCycle: 0, cyclesPerSecond: 1 }
      )
    )

    expect(midi.tracks).toHaveLength(1)
    expect(midi.tracks[0].channel).toBe(9)
    expect(midi.tracks[0].notes.map((note) => note.midi)).toEqual([36, 42])
  })

  it('starts the file at the first exported cycle and reads pitch from freq', () => {
    const midi = parse(
      buildPatternMidi([{ beginCycle: 4, durationCycles: 1, value: { freq: 440 } }], {
        beginCycle: 4,
        cyclesPerSecond: 1
      })
    )

    expect(midi.tracks[0].notes[0].midi).toBe(69)
    expect(midi.tracks[0].notes[0].time).toBe(0)
  })
})
