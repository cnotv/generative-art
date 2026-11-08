/** Every knob runs 0 to 1. For `mids`, 0 is scooped, 0.5 is neutral and 1 is a hump. */
export type StonerGuitarTone = {
  drive: number
  tone: number
  bass: number
  mids: number
  sustain: number
}

export type StonerGuitarToneKnob = keyof StonerGuitarTone

export type StonerGuitarArticulation = 'chord' | 'mute' | 'note'

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
}

export type StonerGuitarSound = {
  soundName: string
  noteName: string
  channels: Float32Array[]
}

export type StonerGuitarBankEntry = {
  articulation: StonerGuitarArticulation
  soundName: string
  noteName: string
}

export type StonerGuitarWavFile = {
  soundName: string
  noteName: string
  wav: ArrayBuffer
}

export type StonerGuitarWorkerRequest = {
  tone: StonerGuitarTone
}

export type StonerGuitarWorkerMessage =
  | { kind: 'result'; files: StonerGuitarWavFile[] }
  | { kind: 'error'; message: string }

export type StonerGuitarSampleMap = Record<string, Record<string, string[]>>

export type StonerGuitarSampleRegistrar = (
  sampleMap: StonerGuitarSampleMap,
  baseUrl: string,
  options: { tag: string }
) => unknown

export type StonerGuitarStatus = 'idle' | 'rendering' | 'ready' | 'error'

export type StonerToneSuggestion = {
  tone: StonerGuitarTone
  explanation: string
}

export type StonerToneRequestOptions = {
  description: string
  currentTone: StonerGuitarTone
  model: string
}
