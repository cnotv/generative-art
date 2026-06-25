import { describe, it, expect } from 'vitest'
import { musicMidiToStrudel } from './midi'

describe('musicMidiToStrudel', () => {
  it('returns silence for no notes', () => {
    expect(musicMidiToStrudel([])).toBe('silence')
  })

  it('quantises notes onto the grid with rests and raw MIDI numbers', () => {
    const pattern = musicMidiToStrudel(
      [
        { time: 0, midiNote: 60 },
        { time: 0.25, midiNote: 64 }
      ],
      0.125
    )
    // steps: 0 -> 60, 1 -> rest, 2 -> 64
    expect(pattern).toBe('note("60 ~ 64").slow(1)')
  })

  it('groups simultaneous notes into a chord and slows multi-cycle sequences', () => {
    const notes = [
      { time: 0, midiNote: 60 },
      { time: 0, midiNote: 67 },
      { time: 1.0, midiNote: 72 } // step 8 -> second cycle
    ]
    const pattern = musicMidiToStrudel(notes, 0.125)
    expect(pattern.startsWith('note("[60,67] ~')).toBe(true)
    expect(pattern.endsWith('72").slow(2)')).toBe(true)
  })
})
