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

/** What the transpiler found in the evaluated code, in Strudel's own untyped shapes. */
export type StrudelEvaluationMeta = {
  miniLocations: unknown[]
  widgets: unknown[]
}

/** The CodeMirror editor: the code, plus inline sliders, widgets and the playhead. */
export type StrudelCodeMirror = {
  /** Replaces the code; false when it already matched, as after the player's own typing. */
  setCode: (patternCode: string) => boolean
  applyEvaluation: (meta: StrudelEvaluationMeta) => void
  highlight: (activeHaps: unknown[], time: number) => void
  clearHighlights: () => void
  destroy: () => void
}

/** The code editor as playback sees it: where to show sliders, widgets, the playhead and visuals. */
export type StrudelEditorHandle = {
  applyEvaluation: (meta: StrudelEvaluationMeta) => void
  highlight: (activeHaps: unknown[], time: number) => void
  clearHighlights: () => void
  getDrawContext: () => CanvasRenderingContext2D | null
  clearVisuals: () => void
}

export type StrudelPlaybackHooks = {
  onEvaluated: (meta: StrudelEvaluationMeta) => void
  onFrame: (activeHaps: unknown[], time: number) => void
  onStopped: () => void
  getDrawContext: () => CanvasRenderingContext2D | null
}

export type StrudelPlaybackLoader = (hooks: StrudelPlaybackHooks) => Promise<StrudelPlayback>

export type StrudelCodeMirrorOptions = {
  parent: HTMLElement
  initialCode: string
  ariaLabel: string
  onCodeChange: (patternCode: string) => void
  onEvaluate: () => void
  onStop: () => void
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
