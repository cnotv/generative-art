import { Midi } from '@tonejs/midi'
import {
  MIDI_DEFAULT_BEATS_PER_MINUTE,
  MIDI_DRUM_SOUNDS,
  STEPS_PER_BAR,
  STEPS_PER_BEAT,
  TRANSCRIPTION_MAX_BARS
} from '../config'
import type { DrumSound, TranscriptionBar, TranscriptionResult, TranscriptionStep } from '../types'
import { matchTriad } from './chords'
import { midiNoteToName } from './pitch'

const PITCH_CLASS_COUNT = 12
const DRUM_ORDER: DrumSound[] = ['bd', 'sd', 'hh']

type MidiNoteEvent = {
  midiNote: number
  firstStep: number
  stepLength: number
  isPercussion: boolean
}

// Ticks rather than seconds, so a tempo change inside the file never shifts notes off the grid.
const readNoteEvents = (midi: Midi): MidiNoteEvent[] => {
  const ticksPerStep = midi.header.ppq / STEPS_PER_BEAT
  return midi.tracks.flatMap((track) =>
    track.notes.map((note) => ({
      midiNote: note.midi,
      firstStep: Math.round(note.ticks / ticksPerStep),
      stepLength: Math.max(1, Math.round(note.durationTicks / ticksPerStep)),
      isPercussion: track.instrument.percussion
    }))
  )
}

const drumsAt = (events: MidiNoteEvent[]): DrumSound[] => {
  const sounds = new Set(events.map((event) => MIDI_DRUM_SOUNDS[event.midiNote]))
  return DRUM_ORDER.filter((sound) => sounds.has(sound))
}

const buildStep = (onsets: MidiNoteEvent[]): TranscriptionStep => {
  const pitched = onsets.filter((event) => !event.isPercussion)
  return {
    drums: drumsAt(onsets.filter((event) => event.isPercussion)),
    bassNote:
      pitched.length === 0
        ? null
        : midiNoteToName(Math.min(...pitched.map((event) => event.midiNote)))
  }
}

const overlapSteps = (event: MidiNoteEvent, barStart: number): number =>
  Math.max(
    0,
    Math.min(event.firstStep + event.stepLength, barStart + STEPS_PER_BAR) -
      Math.max(event.firstStep, barStart)
  )

// Every pitched note sounding in the bar adds its held length to its pitch class.
const barChroma = (pitched: MidiNoteEvent[], barStart: number): Float64Array =>
  Float64Array.from({ length: PITCH_CLASS_COUNT }, (_, pitchClass) =>
    pitched
      .filter((event) => event.midiNote % PITCH_CLASS_COUNT === pitchClass)
      .reduce((energy, event) => energy + overlapSteps(event, barStart), 0)
  )

const buildBar = (barIndex: number, events: MidiNoteEvent[]): TranscriptionBar => {
  const barStart = barIndex * STEPS_PER_BAR
  return {
    steps: Array.from({ length: STEPS_PER_BAR }, (_, stepInBar) =>
      buildStep(events.filter((event) => event.firstStep === barStart + stepInBar))
    ),
    chord: matchTriad(
      barChroma(
        events.filter((event) => !event.isPercussion),
        barStart
      )
    )
  }
}

/**
 * Reads a Standard MIDI File onto the same sixteenth-note grid the audio import uses: drums from
 * the percussion channel, the lowest note starting on each step as the bass, and one triad per
 * bar from every note held in it.
 * @param buffer - the raw .mid file
 * @returns the tempo and up to the configured number of bars
 */
export const transcribeMidi = (buffer: ArrayBuffer): TranscriptionResult => {
  const midi = new Midi(buffer)
  const events = readNoteEvents(midi)
  if (events.length === 0) {
    throw new Error('The MIDI file has no notes')
  }
  const lastStep = Math.max(...events.map((event) => event.firstStep))
  const barCount = Math.min(TRANSCRIPTION_MAX_BARS, Math.floor(lastStep / STEPS_PER_BAR) + 1)
  return {
    beatsPerMinute: Math.round(midi.header.tempos[0]?.bpm ?? MIDI_DEFAULT_BEATS_PER_MINUTE),
    bars: Array.from({ length: barCount }, (_, barIndex) => buildBar(barIndex, events))
  }
}
