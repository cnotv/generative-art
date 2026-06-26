import { describe, it, expect } from 'vitest'
import { chartToStrudel, rgSongCps } from './strudelChart'
import type { RhythmNote } from './config'

const note = (lane: 0 | 1 | 2 | 3, time: number): RhythmNote => ({
  lane,
  midiNote: 60,
  time
})

describe('rgSongCps', () => {
  it('maps bpm to one-bar-per-cycle cps', () => {
    expect(rgSongCps(120)).toBe(0.5)
    expect(rgSongCps(240)).toBe(1)
  })
})

describe('chartToStrudel', () => {
  it('returns silence for an empty chart', () => {
    expect(chartToStrudel([], 120)).toBe('silence')
  })

  it('places lane sounds on the sixteenth grid with rests', () => {
    // bpm 120 -> 0.125s per 16th. step0 = bd (lane0), step1 = sd (lane1)
    const pattern = chartToStrudel([note(0, 0), note(1, 125)], 120)
    expect(pattern).toBe('s("bd sd").slow(1)')
  })

  it('chords simultaneous notes and slows multi-bar charts', () => {
    const notes = [note(0, 0), note(2, 0), note(3, 2000)] // 2000ms -> step 16 -> bar 2
    const pattern = chartToStrudel(notes, 120)
    expect(pattern.startsWith('s("[bd,hh] ~')).toBe(true)
    expect(pattern.endsWith('cp").slow(2)')).toBe(true)
  })
})
