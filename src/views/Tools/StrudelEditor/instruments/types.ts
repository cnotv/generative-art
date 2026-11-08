import type { StrudelFlowSampleGroup } from '@webgamekit/strudel-flow'

export type InstrumentKind =
  | 'electric-guitar'
  | 'bass-guitar'
  | 'acoustic-guitar'
  | 'organ'
  | 'drum-kit'

/** Every knob runs 0 to 1; which knobs a preset has depends on its kind. */
export type InstrumentKnobs = Record<string, number>

export type InstrumentPreset = {
  name: string
  kind: InstrumentKind
  knobs: InstrumentKnobs
}

export type InstrumentKnobDefinition = {
  id: string
  label: string
  hint: string
}

export type InstrumentArticulationDefinition = {
  id: string
  /** How the flow editor's sound pickers name it, such as "Palm mute". */
  label: string
  /** The flow sound picker's family, since a preset's own name says nothing about what it is. */
  familyId: string
  /** Sampled pitches; empty for an unpitched sound such as a drum. */
  notes: string[]
  durationSeconds: number
  /** The sample's loudest point, so a hat sits under a kick without a gain on every line. */
  peak: number
}

export type InstrumentKindDefinition = {
  label: string
  knobs: InstrumentKnobDefinition[]
  articulations: InstrumentArticulationDefinition[]
  assistantPrompt: string
  /** The pattern the tab shows as an example, with `{name}` standing for the preset. */
  usageHint: string
}

/** Normalised so a0 is 1, as the audio cookbook's direct form I difference equation wants. */
export type BiquadCoefficients = {
  b0: number
  b1: number
  b2: number
  a1: number
  a2: number
}

export type PluckedStringOptions = {
  frequency: number
  sampleRate: number
  durationSeconds: number
  /** Seconds for the ring to fall 60 dB, the same at every pitch. */
  decaySeconds: number
  seed: number
  palmMuted: boolean
  /** 0 is a hard burst, 1 a very soft one: a bright pick or a dull finger. */
  softening: number
  /** Where along the string it is plucked, as a fraction of its length. */
  pickPosition: number
  mutedDecaySeconds: number
  mutedLowpassHz: number
}

/** The constants of a plucked string instrument that differ between kinds. */
export type StringModel = {
  minDecaySeconds: number
  maxDecaySeconds: number
  mutedDecaySeconds: number
  mutedLowpassHz: number
  pickPosition: number
  /** Semitones above the root of each string a chord sounds. */
  chordSemitones: number[]
  strumSpacingSeconds: number
  takeDetuneCents: number
}

export type FuzzChain = {
  inputHighpassHz: number
  bassShelfHz: number
  bassShelfMaxDecibels: number
  driveMinDecibels: number
  driveRangeDecibels: number
  firstStageBias: number
  secondStageGain: number
  midsCentreHz: number
  midsMinDecibels: number
  midsRangeDecibels: number
  trebleMinHz: number
  trebleMaxHz: number
  cabinetHighpassHz: number
  cabinetThumpHz: number
  cabinetThumpDecibels: number
  cabinetLowpassHz: number[]
}

export type FuzzControls = {
  drive: number
  bass: number
  mids: number
  tone: number
}

export type BodyResonance = {
  centreHz: number
  maxDecibels: number
  quality: number
}

export type OrganDrawbar = {
  /** Multiple of the played pitch: 16' is 0.5, 8' is 1, 4' is 2. */
  ratio: number
  group: 'body' | 'brightness' | 'fixed'
  weight: number
}

export type DrumMode = {
  frequencyHz: number
  gain: number
  decaySeconds: number
  /** The pitch starts this many times higher and falls to the frequency. */
  dropRatio: number
  dropSeconds: number
}

export type DrumNoise = {
  gain: number
  decaySeconds: number
  highpassHz: number
  lowpassHz: number
}

export type DrumVoice = {
  modes: DrumMode[]
  noise: DrumNoise | null
  /** How strongly the beater or stick click comes through at full punch. */
  clickGain: number
  /** Whether the tune knob moves the modes: cymbals keep their pitch. */
  tunable: boolean
}

export type InstrumentSound = {
  soundName: string
  /** The sampled pitch, or null for an unpitched sound. */
  noteName: string | null
  channels: Float32Array[]
}

export type InstrumentWavFile = {
  soundName: string
  noteName: string | null
  wav: ArrayBuffer
}

export type InstrumentWorkerRequest = {
  preset: InstrumentPreset
}

export type InstrumentWorkerMessage =
  | { kind: 'result'; files: InstrumentWavFile[] }
  | { kind: 'error'; message: string }

/** A pitched sound maps note names to urls; an unpitched one is a plain list. */
export type InstrumentSampleMap = Record<string, Record<string, string[]> | string[]>

export type InstrumentSampleRegistrar = (
  sampleMap: InstrumentSampleMap,
  baseUrl: string,
  options: { tag: string }
) => unknown

export type InstrumentRenderStatus = 'idle' | 'rendering' | 'ready' | 'error'

export type InstrumentToneSuggestion = {
  knobs: InstrumentKnobs
  explanation: string
}

export type InstrumentToneRequestOptions = {
  description: string
  kind: InstrumentKind
  currentKnobs: InstrumentKnobs
  model: string
}

/** One note of a preview phrase: the articulation to play, not the full sound name. */
export type InstrumentPreviewHit = {
  articulation: string
  /** Left out for an unpitched sound. */
  note?: string
  offsetSeconds: number
  durationSeconds: number
  gain: number
}

export type InstrumentNameCheck = { valid: true } | { valid: false; message: string }

export type StoredInstruments = {
  userPresets: InstrumentPreset[]
  tweaks: Record<string, InstrumentKnobs>
  selectedName: string
}

/** Every preset's sounds for the flow editor's pickers, pitched ones apart from drums. */
export type InstrumentPickerGroups = {
  /** Instruments that play notes, for the Voice node. */
  voiceGroups: StrudelFlowSampleGroup[]
  /** Unpitched sounds such as a drum kit's pieces, for the sample and beat nodes. */
  sampleGroups: StrudelFlowSampleGroup[]
}
