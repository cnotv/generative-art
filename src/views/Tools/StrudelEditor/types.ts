import type { Ref } from 'vue'

export type StrudelExample = {
  id: string
  label: string
  code: string
}

export type StrudelEditorStatus = 'idle' | 'playing' | 'error'

export type StrudelEvaluationResult = {
  success: boolean
  errorMessage?: string
}

export type StrudelExampleOption = {
  value: string
  label: string
}

export type StrudelPlayback = {
  evaluateCode: (patternCode: string) => Promise<StrudelEvaluationResult>
  stopPlayback: () => Promise<void>
}

export type StrudelTabId =
  | 'welcome'
  | 'patterns'
  | 'import'
  | 'sounds'
  | 'reference'
  | 'export'
  | 'console'
  | 'settings'

export type StrudelSoundEntry = {
  name: string
  type: string
  sampleCount: number
}

export type StrudelLogEntry = {
  id: number
  message: string
  level: 'info' | 'warn' | 'error'
}

export type DrumSound = 'bd' | 'sd' | 'hh'

export type TranscriptionStep = {
  drums: DrumSound[]
  bassNote: string | null
}

export type TranscriptionBar = {
  steps: TranscriptionStep[]
  chord: string | null
}

export type TranscriptionResult = {
  beatsPerMinute: number
  bars: TranscriptionBar[]
}

export type TempoEstimate = {
  beatsPerMinute: number
  phaseSeconds: number
}

export type TranscriptionStage = 'decoding' | 'onsets' | 'tempo' | 'notes' | 'done'

export type TranscriptionProgress = {
  stage: TranscriptionStage
  fraction: number
}

export type TranscriptionStatus = 'idle' | 'working' | 'done' | 'error'

export type TranscriptionRequest = {
  samples: Float32Array
  sampleRate: number
}

export type TranscriptionWorkerMessage =
  | { kind: 'progress'; progress: TranscriptionProgress }
  | { kind: 'result'; result: TranscriptionResult }
  | { kind: 'error'; message: string }

export type TranscriptionRunner = (
  audioFile: File,
  onProgress: (progress: TranscriptionProgress) => void
) => Promise<TranscriptionResult>

export type StrudelTranscriptionState = {
  transcriptionStatus: Ref<TranscriptionStatus>
  transcriptionProgress: Ref<TranscriptionProgress | null>
  transcriptionResult: Ref<TranscriptionResult | null>
  transcribedCode: Ref<string>
  transcriptionError: Ref<string>
  transcribeAudioFile: (audioFile: File) => Promise<void>
  loadTranscription: () => void
}
