import type { TranscriptionResult, TranscriptionBar, TranscriptionStep } from './types'
import { Midi as ToneMidi } from '@tonejs/midi'

const DEFAULT_BPM = 120

type Note = ToneMidi.NoteInterface

/** Map MIDI note numbers to drum sounds on the drum channel (channel 9/10). */
const DRUM_MAP: Record<number, 'bd' | 'sd' | 'hh'> = {
  36: 'bd',
  35: 'bd',
  38: 'sd',
  40: 'sd',
  42: 'hh',
  46: 'hh'
}

/** Build a bass note name from a MIDI note number. */
const midiNoteToName = (midiNote: number): string => {
  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  return `${NOTE_NAMES[midiNote % 12]}${Math.floor(midiNote / 12) - 1}`
}

const STEPS_PER_BEAT = 4
const STEPS_PER_BAR = 16

/** Parse a MIDI file buffer into a transcription result. */
export const transcribeMidi = (buffer: ArrayBuffer): TranscriptionResult => {
  const midi = new ToneMidi(buffer)
  const allNotes = midi.tracks.flatMap((t) => t.notes).filter((n): n is Note => !!(n as Note).midi)

  if (allNotes.length === 0) throw new Error('No notes found in MIDI file')

  const bpm =
    midi.header.tempo?.microsecondPerBeat !== undefined
      ? 60000000 / midi.header.tempo.microsecondPerBeat / 4
      : DEFAULT_BPM

  const drumChannelNotes = allNotes.filter((n) => n.channel === 9)
  const pitchedNotes = allNotes.filter((n) => n.channel !== 9)
  const maxSeconds = Math.max(...allNotes.map((n) => n.time + n.duration))
  const barCount = Math.ceil(maxSeconds / ((STEPS_PER_BAR / STEPS_PER_BEAT) * (60 / bpm))) || 1

  const bars: TranscriptionBar[] = Array.from({ length: barCount }, () => ({ steps: [], chord: null }))
  for (let b = 0; b < barCount; b++) {
    const bar = bars[b]
    for (let s = 0; s < STEPS_PER_BAR; s++) {
      const stepIdx = b * STEPS_PER_BAR + s
      const stepSeconds = (stepIdx * 60) / (bpm * STEPS_PER_BEAT)
      const activeDrums = drumChannelNotes
        .filter((dn) => dn.time <= stepSeconds && dn.time + dn.duration >= stepSeconds)
        .map((dn) => DRUM_MAP[dn.midi])
        .filter((d): d is 'bd' | 'sd' | 'hh' => !!d)
      const activePitches = pitchedNotes
        .filter((pn) => pn.time <= stepSeconds && pn.time + pn.duration >= stepSeconds)
        .map((pn) => pn.midi)
      const bassNote = activePitches.length > 0 ? midiNoteToName(Math.min(...activePitches)) : null
      bar.steps.push({ drums: activeDrums.length > 0 ? activeDrums : undefined, bassNote })
    }
  }
  return { beatsPerMinute: bpm, bars: bars.map((b) => ({ steps: b.steps, chord: null })) }
}
