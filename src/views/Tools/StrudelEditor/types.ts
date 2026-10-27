import type { Ref } from 'vue'

export type StrudelExample = {
  id: string
  label: string
  code: string
}

/** A pattern the player saved under a name, kept in local storage. */
export type StrudelSavedPattern = {
  name: string
  code: string
}

export type StrudelEditorStatus = 'idle' | 'playing' | 'error'

/** Which editor the left side shows: the code editor or the node canvas. */
export type StrudelEditorMode = 'code' | 'flow'

export type StrudelEvaluationResult = {
  success: boolean
  errorMessage?: string
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

export type StrudelFunctionParameter = {
  name: string
  type: string
  description: string
}

/** One documented Strudel function, as its JSDoc comment in Strudel's own sources describes it. */
export type StrudelFunctionDocumentation = {
  name: string
  synonyms: string[]
  description: string
  params: StrudelFunctionParameter[]
  examples: string[]
}

/** Everything the code editor completes from, beyond the language's own syntax. */
export type StrudelCompletionVocabulary = {
  functionDocumentations: StrudelFunctionDocumentation[]
  chordSymbols: string[]
  scaleNames: string[]
  /** The sounds the engine has registered, which is none until the first Play loads the kit. */
  listSoundNames: () => Promise<string[]>
}

export type StrudelMusicStyleId =
  | 'techno'
  | 'house'
  | 'drum-and-bass'
  | 'hip-hop'
  | 'ambient'
  | 'trance'
  | 'dub'
  | 'breakbeat'

/** What a layer of a pattern plays, as far as its sound names and calls tell. */
export type StrudelInstrumentRole =
  | 'kick'
  | 'snare'
  | 'clap'
  | 'hihat'
  | 'percussion'
  | 'breaks'
  | 'bass'
  | 'chords'
  | 'melody'

/** A visual Strudel draws, by its method name without the inline underscore. */
export type StrudelVisualName =
  | 'pianoroll'
  | 'punchcard'
  | 'scope'
  | 'spectrum'
  | 'spiral'
  | 'pitchwheel'

/** An instrument a style expects, with the layer that adds it and why it belongs. */
export type StrudelStyleInstrument = {
  role: StrudelInstrumentRole
  label: string
  snippet: string
  reason: string
}

export type StrudelMusicStyle = {
  id: StrudelMusicStyleId
  label: string
  /** Words that name the style in a comment, lowercase. */
  keywords: string[]
  minBeatsPerMinute: number
  maxBeatsPerMinute: number
  /** The tempo a tempo hint sets. */
  beatsPerMinute: number
  instruments: StrudelStyleInstrument[]
  visuals: StrudelVisualName[]
}

export type StrudelStyleSource = 'picker' | 'comment' | 'code'

export type StrudelStyleDetection = {
  style: StrudelMusicStyle
  source: StrudelStyleSource
}

export type StrudelCodeRange = {
  from: number
  to: number
}

export type StrudelCodeTempo = {
  /** Null when the tempo is set with an expression too complex to read. */
  beatsPerMinute: number | null
  statement: StrudelCodeRange
}

/** What the hints need to know about a piece of code, read from its syntax tree. */
export type StrudelCodeFacts = {
  /** The first line's comment text without its slashes, or null when it is not a comment. */
  firstLineComment: string | null
  /** Where the comments at the top of the code end, or 0 when it starts with code. */
  headerEnd: number
  tempo: StrudelCodeTempo | null
  instrumentRoles: StrudelInstrumentRole[]
  visualNames: StrudelVisualName[]
  /** The top-level statements that make sound, `$:` blocks and plain expressions alike. */
  patternStatements: StrudelCodeRange[]
  usesPatternBlocks: boolean
}

export type StrudelHintKind = 'tempo' | 'instrument' | 'visual'

export type StrudelHint = {
  id: string
  kind: StrudelHintKind
  title: string
  reason: string
  /** The code the Add button inserts. */
  snippet: string
}

export type StrudelTabId =
  | 'hints'
  | 'welcome'
  | 'patterns'
  | 'import'
  | 'midi'
  | 'reference'
  | 'export'
  | 'console'
  | 'settings'
  | 'flow'

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
  transcribeFile: (chosenFile: File) => Promise<void>
  loadTranscription: () => void
}

export type MidiDeviceStatus = 'idle' | 'connecting' | 'ready' | 'unsupported' | 'denied'

export type MidiDevicesState = {
  midiDeviceStatus: Ref<MidiDeviceStatus>
  midiInputNames: Ref<string[]>
  midiOutputNames: Ref<string[]>
  connectMidiDevices: () => Promise<void>
}

export type MidiSnippet = {
  id: string
  title: string
  description: string
  code: string
}
