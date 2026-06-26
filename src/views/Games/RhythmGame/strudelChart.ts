import type { RhythmNote } from './config'

/** Drum sound (from the dirt-samples bank) played for each lane's hit. */
const LANE_SOUNDS = ['bd', 'sd', 'hh', 'cp'] as const

/** Sixteenth-note grid: 4 steps per beat. */
const STEPS_PER_BEAT = 4
const STEPS_PER_BAR = STEPS_PER_BEAT * 4

/**
 * Cycles-per-second so one Strudel cycle equals one bar (4 beats) at `bpm`.
 * @param bpm - Song tempo in beats per minute
 * @returns The Strudel cps value
 */
export const rgSongCps = (bpm: number): number => bpm / 240

/**
 * Build a Strudel drum pattern from a note chart so the audio lines up with the
 * falling notes: each note becomes its lane's drum sound on a sixteenth grid,
 * simultaneous notes become a chord, and the sequence is slowed to span its bars.
 * Played at `rgSongCps(bpm)`, grid step N lands at the same time as a chart note
 * at `N * (60/bpm/4)` seconds, so chart and audio stay in sync by construction.
 * @param notes - The chart notes (lane + time in ms)
 * @param bpm - Song tempo in beats per minute
 * @returns A Strudel `s(...)` pattern string (or `silence` when empty)
 */
export const chartToStrudel = (notes: RhythmNote[], bpm: number): string => {
  if (notes.length === 0) return 'silence'
  const secondsPerStep = 60 / bpm / STEPS_PER_BEAT
  const stepOf = (timeMs: number): number => Math.round(timeMs / 1000 / secondsPerStep)
  const lastStep = notes.reduce((max, note) => Math.max(max, stepOf(note.time)), 0)

  const byStep = notes.reduce<Record<number, string[]>>(
    (groups, note) => {
      const step = stepOf(note.time)
      return { ...groups, [step]: [...(groups[step] ?? []), LANE_SOUNDS[note.lane]] }
    },
    {} as Record<number, string[]>
  )

  const tokens = Array.from({ length: lastStep + 1 }, (_unused, index) => {
    const sounds = byStep[index]
    if (!sounds) return '~'
    return sounds.length === 1 ? sounds[0] : `[${sounds.join(',')}]`
  })

  const bars = Math.max(1, Math.ceil(tokens.length / STEPS_PER_BAR))
  return `s("${tokens.join(' ')}").slow(${bars})`
}
