import { Midi } from '@tonejs/midi'
import type { RhythmNote, RgLane, RgDifficulty } from './config'

const MIN_GAP_MS: Record<RgDifficulty, number> = { easy: 450, medium: 180, hard: 0 }

const applyDifficulty = (notes: RhythmNote[], difficulty: RgDifficulty): RhythmNote[] => {
  const minGap = MIN_GAP_MS[difficulty]
  if (minGap === 0) return notes
  return notes.reduce<RhythmNote[]>((accumulator, note) => {
    const last = accumulator.at(-1)
    return !last || note.time - last.time >= minGap ? [...accumulator, note] : accumulator
  }, [])
}

const pitchToLane = (pitch: number, min: number, range: number): RgLane =>
  (range === 0 ? 0 : Math.min(3, Math.floor(((pitch - min) / range) * 4))) as RgLane

/**
 * Parse a MIDI ArrayBuffer into a RhythmNote array, mapping pitches to 4 lanes
 * by quartile range and filtering note density by difficulty.
 * @param buffer - Raw MIDI binary data.
 * @param difficulty - Controls minimum gap between consecutive notes.
 * @returns Parsed and filtered note array sorted by time.
 */
export const parseMidiBuffer = (buffer: ArrayBuffer, difficulty: RgDifficulty): RhythmNote[] => {
  const midi = new Midi(buffer)

  const track = [...midi.tracks]
    .filter((t) => t.notes.length > 0)
    .sort((a, b) => b.notes.length - a.notes.length)[0]

  if (!track) throw new Error('No notes found in MIDI file')

  const sorted = [...track.notes].sort((a, b) => a.time - b.time)
  const pitches = sorted.map((n) => n.midi).sort((a, b) => a - b)
  const min = pitches[0]
  const range = pitches[pitches.length - 1] - min

  const allNotes: RhythmNote[] = sorted.map((n) => ({
    lane: pitchToLane(n.midi, min, range),
    midiNote: n.midi,
    time: Math.round(n.time * 1000)
  }))

  return applyDifficulty(allNotes, difficulty)
}

/**
 * Convenience wrapper — reads a File into an ArrayBuffer then delegates to parseMidiBuffer.
 * @param file - The .mid file uploaded by the user.
 * @param difficulty - Controls minimum gap between consecutive notes.
 * @returns Parsed and filtered note array sorted by time.
 */
export const parseMidiFile = async (file: File, difficulty: RgDifficulty): Promise<RhythmNote[]> =>
  parseMidiBuffer(await file.arrayBuffer(), difficulty)
