/** A minimal MIDI note: when it starts (seconds) and its MIDI pitch number. */
export interface MidiNoteInput {
  time: number
  midiNote: number
}

/** Grid resolution: steps quantised per Strudel cycle. */
const STEPS_PER_CYCLE = 8

/**
 * Convert MIDI notes into a Strudel `note(...)` pattern string. Notes are
 * quantised onto a fixed grid (raw MIDI numbers, so no note-name lookup is
 * needed); simultaneous notes become a chord, empty steps become rests, and the
 * sequence is slowed to span its full number of cycles. Tempo (cps) is set by the
 * caller so the grid lines up with real time.
 * @param notes - MIDI notes with seconds-based onsets
 * @param secondsPerStep - Real seconds each grid step represents (default 0.125)
 * @returns A playable Strudel pattern string (or `silence` when there are no notes)
 */
export const musicMidiToStrudel = (notes: MidiNoteInput[], secondsPerStep = 0.125): string => {
  if (notes.length === 0) return 'silence'
  const sorted = [...notes].sort((first, second) => first.time - second.time)
  const startTime = sorted[0].time
  const stepOf = (time: number): number => Math.round((time - startTime) / secondsPerStep)
  const lastStep = stepOf(sorted[sorted.length - 1].time)

  const byStep = sorted.reduce<Record<number, number[]>>(
    (groups, note) => {
      const step = stepOf(note.time)
      return { ...groups, [step]: [...(groups[step] ?? []), note.midiNote] }
    },
    {} as Record<number, number[]>
  )

  const tokens = Array.from({ length: lastStep + 1 }, (_unused, index) => {
    const pitches = byStep[index]
    if (!pitches) return '~'
    return pitches.length === 1 ? String(pitches[0]) : `[${pitches.join(',')}]`
  })

  const cycles = Math.max(1, Math.ceil(tokens.length / STEPS_PER_CYCLE))
  return `note("${tokens.join(' ')}").slow(${cycles})`
}
