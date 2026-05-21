import { Midi } from '@tonejs/midi'
import { midiGetTracks } from '@webgamekit/audio'
import type { ScheduledNote } from '@webgamekit/audio'
import type { RhythmNote, RgLane, RgDifficulty } from './config'

export type { MidiTrackInfo } from '@webgamekit/audio'
export { midiGetTracks as getMidiTracks } from '@webgamekit/audio'
export { midiParseBackground as parseAllMidiNotes } from '@webgamekit/audio'

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

const trackToNotes = (track: Midi['tracks'][number], difficulty: RgDifficulty): RhythmNote[] => {
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
 * Parse a specific track from a MIDI ArrayBuffer into a RhythmNote array.
 * @param buffer - Raw MIDI binary data.
 * @param trackIndex - Index of the track to parse (from getMidiTracks).
 * @param difficulty - Controls minimum gap between consecutive notes.
 * @returns Parsed and filtered note array sorted by time.
 */
export const parseMidiTrack = (
  buffer: ArrayBuffer,
  trackIndex: number,
  difficulty: RgDifficulty
): RhythmNote[] => {
  const midi = new Midi(buffer)
  const track = midi.tracks[trackIndex]
  if (!track || track.notes.length === 0) throw new Error(`Track ${trackIndex} has no notes`)
  return trackToNotes(track, difficulty)
}

/**
 * Parse a MIDI ArrayBuffer using the track with the most notes.
 * @param buffer - Raw MIDI binary data.
 * @param difficulty - Controls minimum gap between consecutive notes.
 * @returns Parsed and filtered note array sorted by time.
 */
export const parseMidiBuffer = (buffer: ArrayBuffer, difficulty: RgDifficulty): RhythmNote[] => {
  const tracks = midiGetTracks(buffer)
  if (tracks.length === 0) throw new Error('No notes found in MIDI file')
  return parseMidiTrack(buffer, tracks[0].index, difficulty)
}

/**
 * Convenience wrapper — reads a File into an ArrayBuffer then delegates to parseMidiBuffer.
 * @param file - The .mid file uploaded by the user.
 * @param difficulty - Controls minimum gap between consecutive notes.
 * @returns Parsed and filtered note array sorted by time.
 */
export const parseMidiFile = async (file: File, difficulty: RgDifficulty): Promise<RhythmNote[]> =>
  parseMidiBuffer(await file.arrayBuffer(), difficulty)

// Re-export package type for callers that used to import it from here
export type { ScheduledNote }
