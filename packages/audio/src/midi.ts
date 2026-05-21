import { Midi } from '@tonejs/midi'
import { midiNoteToFreq } from './midiNote'
import type { ScheduledNote } from './types'

export type MidiTrackInfo = { index: number; name: string; noteCount: number }

const resolveTrackLabel = (track: Midi['tracks'][number], index: number): string => {
  const parts = [track.name, track.instrument?.name].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : `Track ${index + 1}`
}

/**
 * List all tracks in a MIDI file that contain at least one note.
 * The track name includes the MIDI instrument name when present.
 * @param buffer - Raw MIDI binary data.
 * @returns Track metadata sorted by note count descending.
 */
export const midiGetTracks = (buffer: ArrayBuffer): MidiTrackInfo[] => {
  const midi = new Midi(buffer)
  return midi.tracks
    .map((t, i) => ({ index: i, name: resolveTrackLabel(t, i), noteCount: t.notes.length }))
    .filter((t) => t.noteCount > 0)
    .sort((a, b) => b.noteCount - a.noteCount)
}

/**
 * Convert every note in every MIDI track into audio-ready ScheduledNotes
 * using real pitches and actual note durations. Intended for background playback.
 * @param buffer - Raw MIDI binary data.
 * @param volume - Playback volume for all notes (default 0.12).
 * @returns All notes across all tracks as ScheduledNote[], sorted by time.
 */
export const midiParseBackground = (buffer: ArrayBuffer, volume = 0.12): ScheduledNote[] => {
  const midi = new Midi(buffer)
  return midi.tracks
    .flatMap((track) =>
      track.notes.map((n) => ({
        time: Math.round(n.time * 1000),
        freq: midiNoteToFreq(n.midi),
        duration: Math.max(50, Math.round(n.duration * 1000)),
        volume,
        waveType: 'sine' as const,
        attackTime: 0.01
      }))
    )
    .sort((a, b) => a.time - b.time)
}
