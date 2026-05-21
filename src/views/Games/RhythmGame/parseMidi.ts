import { Midi } from '@tonejs/midi'
import { midiNoteToFreq } from '@webgamekit/audio'
import type { ScheduledNote } from '@webgamekit/audio'
import type { RhythmNote, RgLane, RgDifficulty } from './config'

const MIN_GAP_MS: Record<RgDifficulty, number> = { easy: 450, medium: 180, hard: 0 }

export type MidiTrackInfo = { index: number; name: string; noteCount: number }

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
 * List all tracks in a MIDI file that contain at least one note.
 * @param buffer - Raw MIDI binary data.
 * @returns Track metadata sorted by note count descending.
 */
export const getMidiTracks = (buffer: ArrayBuffer): MidiTrackInfo[] => {
  const midi = new Midi(buffer)
  return midi.tracks
    .map((t, i) => ({ index: i, name: t.name || `Track ${i + 1}`, noteCount: t.notes.length }))
    .filter((t) => t.noteCount > 0)
    .sort((a, b) => b.noteCount - a.noteCount)
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
  const tracks = getMidiTracks(buffer)
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

/**
 * Convert every note in every MIDI track into audio-ready ScheduledNotes using
 * real pitches and actual note durations. Intended for background playback.
 * @param buffer - Raw MIDI binary data.
 * @returns All notes across all tracks as ScheduledNote[], sorted by time.
 */
export const parseAllMidiNotes = (buffer: ArrayBuffer): ScheduledNote[] => {
  const midi = new Midi(buffer)
  return midi.tracks
    .flatMap((track) =>
      track.notes.map((n) => ({
        time: Math.round(n.time * 1000),
        freq: midiNoteToFreq(n.midi),
        duration: Math.max(50, Math.round(n.duration * 1000)),
        volume: 0.12,
        waveType: 'sine' as const,
        attackTime: 0.01
      }))
    )
    .sort((a, b) => a.time - b.time)
}
