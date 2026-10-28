import type { Ref } from 'vue'

export type StrudelExample = {
  id: string
  label: string
  code: string
}

/** A sample manifest Strudel's `samples()` loads, with the folder its files are served from. */
export type StrudelSampleBank = {
  /** The sounds tab's heading for the bank's sounds. */
  label: string
  manifestUrl: string
  /** Where its files are served; also how a registered sound is traced back to its bank. */
  baseUrl: string
  /** strudel.cc's grouping, so the sounds tab can tell drum machines from other samples. */
  tag?: string
  /** Splits the bank into one group per machine, its sounds named `<machine>_<part>`. */
  groupsByMachine?: boolean
  /** Shared by every sound in the bank, so dropped from their readable names. */
  namePrefix?: string
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

export type StrudelExportFormat = 'wav' | 'midi'

export type StrudelExportOptions = {
  /** WAV is the sound as it plays; MIDI is its notes, for a DAW, a synth or a game. */
  format: StrudelExportFormat
  startCycle: number
  endCycle: number
  sampleRate: number
  fileName: string
}

export type StrudelExportStatus = 'idle' | 'rendering' | 'done' | 'error'

/** Where the scheduler is: the cycle it is playing and how fast cycles pass. */
export type StrudelPlaybackPosition = {
  cycle: number
  cyclesPerSecond: number
}

export type StrudelPlayback = {
  evaluateCode: (patternCode: string) => Promise<StrudelEvaluationResult>
  stopPlayback: () => Promise<void>
  readPosition: () => StrudelPlaybackPosition
  /** Plays on from this cycle, or starts there on the next Play when stopped. */
  seekToCycle: (cycle: number) => void
  /** Bars the last played pattern takes to repeat as a whole, or null when it does not within the timeline's limit. */
  measureLoop: () => number | null
  /** Renders the cycles offline and downloads them as a WAV file. */
  renderToWav: (
    patternCode: string,
    exportOptions: StrudelExportOptions
  ) => Promise<StrudelEvaluationResult>
  /** How many cycles one repetition of the code lasts, read without playing it. */
  measureRepetition: (patternCode: string) => Promise<number>
  /** Downloads the notes that start inside the cycles as a standard MIDI file. */
  renderToMidi: (
    patternCode: string,
    exportOptions: StrudelExportOptions
  ) => Promise<StrudelEvaluationResult>
}

/** One event of a pattern that starts inside the exported cycles, read off Strudel's hap. */
export type StrudelScheduledHap = {
  value: unknown
  beginCycle: number
  durationCycles: number
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
  /** The top-level statements that make sound, `$:` blocks and plain expressions alike, muted blocks left out. */
  patternStatements: StrudelPatternStatement[]
  usesPatternBlocks: boolean
}

/** A top-level statement that makes sound, with what it alone plays and draws. */
export type StrudelPatternStatement = StrudelCodeRange & {
  /** The line the statement starts on, counting from 1. */
  line: number
  /** A `$:` block, which can be muted on its own, rather than the code's single pattern. */
  isBlock: boolean
  instrumentRoles: StrudelInstrumentRole[]
  visualNames: StrudelVisualName[]
  /** Each visual call chained on it, from its dot to its closing parenthesis. */
  visualCalls: StrudelCodeRange[]
  callNames: string[]
}

/** A variation a layer can take, chained onto the first layer playing one of its roles. */
export type StrudelPatternIdea = {
  id: string
  title: string
  reason: string
  snippet: string
  /** The call that shows a layer already has this variation. */
  callName: string
  targetRoles: StrudelInstrumentRole[]
}

/** What every hint is built from: the code, what was read from it, and its style. */
export type StrudelHintContext = {
  code: string
  facts: StrudelCodeFacts
  style: StrudelMusicStyle
}

export type StrudelCodeEdit = {
  from: number
  to: number
  insert: string
}

/** Review what is there, fill what the style is missing, or keep going with an idea. */
export type StrudelHintKind = 'review' | 'tempo' | 'instrument' | 'visual' | 'idea'

/** What a hint's button does: add code, mute a layer with `_$:`, or remove code. */
export type StrudelHintAction = 'Add' | 'Mute' | 'Remove'

export type StrudelHint = {
  id: string
  kind: StrudelHintKind
  title: string
  reason: string
  /** The code the hint shows. */
  snippet: string
  actionLabel: StrudelHintAction
  /** What the button changes, worked out from the code the hint was built from. */
  edits: StrudelCodeEdit[]
}

export type StrudelTabId =
  | 'hints'
  | 'welcome'
  | 'patterns'
  | 'sounds'
  | 'import'
  | 'midi'
  | 'reference'
  | 'export'
  | 'console'
  | 'settings'
  | 'flow'

export type StrudelSoundEntry = {
  /** What code plays it by, as in `s("rolandtr909_bd")`. */
  name: string
  /** A readable name, such as "Bass drum" or "Acoustic bass". */
  label: string
  /** The heading it is listed under: its bank, drum machine or instrument family. */
  group: string
  type: string
  tag: string
  sampleCount: number
}

/** Sounds listed under one heading in the sounds tab. */
export type StrudelSoundGroup = {
  label: string
  sounds: StrudelSoundEntry[]
}

/** A drum machine as its alias list spells it. */
export type StrudelDrumMachine = {
  /** The machine's own spelling, such as "RolandTR909". */
  name: string
  /** The short bank name that also selects it, such as "TR909". */
  alias: string
}

/** What naming the sounds needs beyond the sound map, gathered while the library loads. */
export type StrudelSoundLibrary = {
  /** Keyed by the lower-case id the machine's sounds start with, such as "rolandtr909". */
  drumMachines: Record<string, StrudelDrumMachine>
}

export type StrudelSoundFilter = 'all' | 'samples' | 'drum-machines' | 'synths' | 'wavetables'

export type StrudelSoundsStatus = 'idle' | 'loading' | 'ready' | 'error'

/** Strudel ships untyped JS, so every function read off one of its modules starts as this. */
export type StrudelUnknownCallable = (...callArguments: unknown[]) => unknown

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
  kind: 'grid'
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
  | { kind: 'result'; result: TranscriptionOutput }
  | { kind: 'error'; message: string }

export type TranscriptionRunner = (
  audioFile: File,
  onProgress: (progress: TranscriptionProgress) => void
) => Promise<TranscriptionOutput>

/** One file the Import tab read, kept in the order it arrived. */
export type ImportedTranscription = {
  id: number
  sourceName: string
  result: TranscriptionOutput
}

export type StrudelTranscriptionState = {
  transcriptionStatus: Ref<TranscriptionStatus>
  transcriptionProgress: Ref<TranscriptionProgress | null>
  importedTranscriptions: Ref<ImportedTranscription[]>
  transcribedCode: Readonly<Ref<string>>
  transcriptionWarnings: Readonly<Ref<string[]>>
  transcriptionError: Ref<string>
  transcribeFiles: (chosenFiles: File[]) => Promise<void>
  removeTranscription: (transcriptionId: number) => void
  loadTranscription: () => void
  addTranscription: () => void
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

/** What an import produces: a grid of drums, bass and chords, the notes of a tab or a score. */
export type TranscriptionOutput = TranscriptionResult | TabTranscription | ScoreTranscription

export type TabInstrument = 'bass' | 'guitar'

/** One struck chord or note of a tab bar; an empty note list is a rest. */
export type TabEvent = {
  notes: string[]
  beats: number
}

export type TabTranscription = {
  kind: 'tab'
  beatsPerMinute: number
  instrument: TabInstrument
  bars: TabEvent[][]
  warnings: string[]
}

/** A tab read from one file, before it joins a song. */
export type TabSource = {
  sourceName: string
  transcription: TabTranscription
}

/** A tab in a song, named for its block: its instrument, numbered when another shares it. */
export type TabSongInstrument = TabSource & { label: string }

/** Several tabs played together on one tempo, the first tab's. */
export type TabSong = {
  beatsPerMinute: number
  instruments: TabSongInstrument[]
  warnings: string[]
}

/** How far each pixel sits from the page background, so dark and light themes read alike. */
export type TabImage = {
  width: number
  height: number
  deviation: Uint8Array
}

export type TabImageRequest = {
  width: number
  height: number
  pixels: Uint8ClampedArray
}

export type TabSystem = {
  lineYs: number[]
  startX: number
  endX: number
}

export type TabBarSpan = {
  startX: number
  endX: number
}

export type TabGlyph = {
  centerX: number
  lineIndex: number
  fret: number | null
}

export type TabStem = {
  x: number
  beams: number
  isTriplet: boolean
}

export type Clef = 'treble' | 'bass'

/** A treble and a bass staff joined by bar lines, as in piano music. */
export type GrandStaff = {
  treble: TabSystem
  bass: TabSystem
}

/** What sits at the start of a staff: the clef, the key signature and, on the first, the metre. */
export type StaffPrelude = {
  clef: Clef
  /** Positive for sharps, negative for flats. */
  keyAccidentals: number
  beatsPerBar: number | null
  endX: number
}

export type PixelBox = {
  left: number
  right: number
  top: number
  bottom: number
}

export type NoteHead = PixelBox & {
  centerX: number
  centerY: number
  isHollow: boolean
}

/** A struck chord, a held note or a rest of one staff, before it is named and timed. */
export type ScoreEvent = {
  x: number
  heads: NoteHead[]
  beats: number
}

export type ScoreBar = {
  rightHand: TabEvent[]
  leftHand: TabEvent[]
}

export type ScoreTranscription = {
  kind: 'score'
  beatsPerMinute: number
  beatsPerBar: number
  bars: ScoreBar[]
  warnings: string[]
}
