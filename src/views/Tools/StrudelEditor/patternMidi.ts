import { Midi } from '@tonejs/midi'
// The util module alone: the package entry pulls in browser-only modules.
import { valueToMidi } from '@strudel/core/util.mjs'
import {
  MIDI_DRUM_CHANNEL,
  STRUDEL_BEATS_PER_CYCLE,
  STRUDEL_DRUM_MIDI_NOTES,
  STRUDEL_EXPORT_DEFAULT_VELOCITY
} from './config'
import type { StrudelScheduledHap } from './types'

type MidiNote = {
  trackName: string
  midi: number
  time: number
  duration: number
  velocity: number
}

const DRUM_TRACK_NAME = 'drums'
const SECONDS_PER_MINUTE = 60
const MIDI_CHANNEL_COUNT = 16

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const readNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined

const hasPitch = (value: Record<string, unknown>): boolean =>
  typeof value.freq === 'number' || typeof value.note === 'string' || typeof value.note === 'number'

/**
 * The key and track an event plays on: its pitch on a track named after its sound, or a General
 * MIDI drum key for a known drum sample. Samples with neither, such as a vocal chop, have no
 * note to write and are left out.
 * @param value - the event's control values, as Strudel hands them to superdough
 * @returns the MIDI key and track name, or undefined when the event has no note
 */
const resolveKey = (
  value: Record<string, unknown>
): { midi: number; trackName: string } | undefined => {
  const soundName = typeof value.s === 'string' ? value.s : undefined
  if (hasPitch(value)) {
    return { midi: Math.round(valueToMidi(value)), trackName: soundName ?? 'notes' }
  }
  const drumKey = soundName === undefined ? undefined : STRUDEL_DRUM_MIDI_NOTES[soundName]
  return drumKey === undefined ? undefined : { midi: drumKey, trackName: DRUM_TRACK_NAME }
}

const toVelocity = (value: Record<string, unknown>): number => {
  const velocity = readNumber(value.velocity) ?? STRUDEL_EXPORT_DEFAULT_VELOCITY
  const gain = readNumber(value.gain) ?? 1
  return Math.min(Math.max(velocity * gain, 0), 1)
}

const toMidiNote =
  (beginCycle: number, cyclesPerSecond: number) =>
  (event: StrudelScheduledHap): MidiNote[] => {
    const value = isRecord(event.value) ? event.value : undefined
    const key = value === undefined ? undefined : resolveKey(value)
    return key === undefined || value === undefined
      ? []
      : [
          {
            ...key,
            time: (event.beginCycle - beginCycle) / cyclesPerSecond,
            duration: event.durationCycles / cyclesPerSecond,
            velocity: toVelocity(value)
          }
        ]
  }

const groupByTrack = (notes: MidiNote[]): Map<string, MidiNote[]> =>
  notes.reduce(
    (tracks, note) => tracks.set(note.trackName, [...(tracks.get(note.trackName) ?? []), note]),
    new Map<string, MidiNote[]>()
  )

/**
 * A standard MIDI file of a pattern's notes: one track per sound, drums on the General MIDI
 * percussion channel, timed so the first exported cycle starts the file.
 * @param events - the pattern's events with an onset, in cycles
 * @param timing - the first exported cycle and the pattern's cycles per second
 * @param timing.beginCycle - the cycle the file starts at
 * @param timing.cyclesPerSecond - the pattern's speed, which sets the file's tempo
 * @returns the file's bytes
 */
export const buildPatternMidi = (
  events: StrudelScheduledHap[],
  timing: { beginCycle: number; cyclesPerSecond: number }
): Uint8Array => {
  const midi = new Midi()
  // Before any note is added: notes convert their seconds to ticks at this tempo.
  midi.header.setTempo(timing.cyclesPerSecond * SECONDS_PER_MINUTE * STRUDEL_BEATS_PER_CYCLE)
  const tracks = groupByTrack(events.flatMap(toMidiNote(timing.beginCycle, timing.cyclesPerSecond)))
  const pitchedChannels = Array.from(
    { length: MIDI_CHANNEL_COUNT },
    (_, channel) => channel
  ).filter((channel) => channel !== MIDI_DRUM_CHANNEL)
  const trackEntries = [...tracks.entries()]
  trackEntries.forEach(([trackName, notes], trackIndex) => {
    const track = midi.addTrack()
    track.name = trackName
    track.channel =
      trackName === DRUM_TRACK_NAME
        ? MIDI_DRUM_CHANNEL
        : pitchedChannels[trackIndex % pitchedChannels.length]
    notes.forEach(({ midi: key, time, duration, velocity }) =>
      track.addNote({ midi: key, time, duration, velocity })
    )
  })
  return midi.toArray()
}
