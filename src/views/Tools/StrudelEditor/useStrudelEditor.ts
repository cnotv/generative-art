import { computed, ref, shallowRef, watch } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import { appendStrudelFlowBlocks } from '@webgamekit/strudel-flow'
import { readStorage, writeStorage } from '@/utils/storage'
import {
  DEFAULT_STRUDEL_EXAMPLE_ID,
  ELECTRO_TUNES,
  STRUDEL_EXAMPLES,
  STRUDEL_SAVED_CODE_STORAGE_KEY,
  STRUDEL_TABS
} from './config'
import { useSavedPatterns } from './useSavedPatterns'
import { useStrudelExport } from './useStrudelExport'
import { useStrudelLog } from './useStrudelLog'
import { useStrudelPatternLoad } from './useStrudelPatternLoad'
import type {
  StrudelEditorHandle,
  StrudelEditorStatus,
  StrudelExample,
  StrudelExportOptions,
  StrudelExportStatus,
  StrudelLogEntry,
  StrudelPlayback,
  StrudelPlaybackHooks,
  StrudelPlaybackLoader,
  StrudelTabId,
  StrudelTranscriptionState,
  TranscriptionRunner
} from './types'
import { loadDefaultStrudelPlayback, readHapSourceOffsets } from './strudelPlayback'
import { runTranscription } from './transcription/runTranscription'
import { useStrudelTranscription } from './transcription/useStrudelTranscription'
import { useStrudelTimeline } from './timeline/useStrudelTimeline'

/**
 * Example with the given id.
 * @param exampleList - examples to search
 * @param exampleId - id to find
 * @returns the matching example, or undefined
 */
export const findStrudelExample = (
  exampleList: StrudelExample[],
  exampleId: string
): StrudelExample | undefined => exampleList.find((example) => example.id === exampleId)

/**
 * The example to open with: the requested one, or the first when it does not exist.
 * @param exampleList - examples to choose from
 * @param defaultExampleId - id of the preferred example
 * @returns the example to show first, or undefined for an empty list
 */
export const resolveDefaultStrudelExample = (
  exampleList: StrudelExample[],
  defaultExampleId: string
): StrudelExample | undefined => findStrudelExample(exampleList, defaultExampleId) ?? exampleList[0]

type StrudelEditorOptions = {
  initialExamples?: StrudelExample[]
  initialExampleId?: string
  playbackLoader?: StrudelPlaybackLoader
  transcriptionRunner?: TranscriptionRunner
}

type StrudelEditorState = StrudelTranscriptionState & {
  selectedExampleId: Ref<string>
  patternCode: Ref<string>
  editorStatus: Ref<StrudelEditorStatus>
  /** True while a pattern plays and the code on screen has changed since it started. */
  hasUnplayedChanges: ComputedRef<boolean>
  /** The code last evaluated, which the source offsets of the playing notes refer to. */
  playingCode: Ref<string>
  /** Where in `playingCode` each sounding note comes from, one list per note, empty while stopped. */
  playingSourceOffsets: Ref<number[][]>
  errorMessage: Ref<string>
  examples: StrudelExample[]
  electroTunes: StrudelExample[]
  logEntries: Ref<StrudelLogEntry[]>
  appendLog: (message: string, level?: StrudelLogEntry['level']) => void
  /** The tab open in the drawer, or null while it is closed. */
  activeTab: Ref<StrudelTabId | null>
  tabList: { id: StrudelTabId; label: string }[]
  selectExample: (exampleId: string) => void
  selectElectroTune: (tuneId: string) => void
  /** Loads the example or tune with this id; false when neither has it. */
  selectPattern: (patternId: string) => boolean
  /** The patterns saved under a name, newest first, as the patterns tab lists them. */
  savedPatterns: ComputedRef<StrudelExample[]>
  /** Saves the code on screen under a name, replacing a save with the same id. */
  savePattern: (name: string) => void
  deleteSavedPattern: (savedPatternId: string) => void
  updatePatternCode: (nextCode: string) => void
  playPattern: () => Promise<void>
  /** Plays what was just loaded, once whatever it replaced has stopped. */
  playLoadedPattern: () => Promise<void>
  stopPattern: () => Promise<void>
  exportStatus: Ref<StrudelExportStatus>
  exportError: Ref<string>
  /** Renders the code on screen offline and downloads it as a WAV or MIDI file. */
  exportPattern: (exportOptions: StrudelExportOptions) => Promise<void>
  /** Cycles in one repetition of the code, once measured for the export tab. */
  repetitionCycles: Ref<number | null>
  measureRepetition: () => Promise<void>
  setActiveTab: (tabId: StrudelTabId | null) => void
  clearLogEntries: () => void
  attachEditor: (editorHandle: StrudelEditorHandle | null) => void
}

const loadCachedPlayback = async (
  playbackReference: Ref<StrudelPlayback | null>,
  playbackLoader: StrudelPlaybackLoader,
  playbackHooks: StrudelPlaybackHooks
): Promise<StrudelPlayback> => {
  if (playbackReference.value !== null) {
    return playbackReference.value
  }
  const playback = await playbackLoader(playbackHooks)
  playbackReference.value = playback
  return playback
}

// Playback outlives any one editor instance, so it reaches the editor through this ref.
const createPlaybackHooks = (
  editorHandle: Ref<StrudelEditorHandle | null>,
  playingSourceOffsets: Ref<number[][]>
): StrudelPlaybackHooks => ({
  onEvaluated: (meta) => editorHandle.value?.applyEvaluation(meta),
  onFrame: (activeHaps, time) => {
    editorHandle.value?.highlight(activeHaps, time)
    const offsets = readHapSourceOffsets(activeHaps)
    // Frames come every animation tick; a new array each time would re-render the flow at 60 Hz.
    const joinOffsets = (lists: number[][]): string => lists.map((list) => list.join()).join(';')
    if (joinOffsets(offsets) !== joinOffsets(playingSourceOffsets.value)) {
      playingSourceOffsets.value = offsets
    }
  },
  onStopped: () => {
    playingSourceOffsets.value = []
    editorHandle.value?.clearHighlights()
    editorHandle.value?.clearVisuals()
  },
  getDrawContext: () => editorHandle.value?.getDrawContext() ?? null
})

/**
 * Editor state: the selected example, the code, playback, the console log, the active tab
 * and audio transcription.
 * @param editorOptions - examples, playback loader and transcription runner, for tests
 * @returns reactive editor state and its actions
 */
export const useStrudelEditor = (
  editorOptions?: StrudelEditorOptions
): StrudelEditorState & ReturnType<typeof useStrudelTimeline> => {
  const exampleList = editorOptions?.initialExamples ?? STRUDEL_EXAMPLES
  const defaultExample =
    resolveDefaultStrudelExample(
      exampleList,
      editorOptions?.initialExampleId ?? DEFAULT_STRUDEL_EXAMPLE_ID
    ) ?? exampleList[0]
  const playbackLoader = editorOptions?.playbackLoader ?? loadDefaultStrudelPlayback

  const selectedExampleId = ref(defaultExample?.id ?? '')
  // The code from the last visit, so a refresh or a closed tab loses nothing.
  const patternCode = ref(readStorage(STRUDEL_SAVED_CODE_STORAGE_KEY) ?? defaultExample?.code ?? '')
  watch(patternCode, (code) => writeStorage(STRUDEL_SAVED_CODE_STORAGE_KEY, code))
  const editorStatus = ref<StrudelEditorStatus>('idle')
  const errorMessage = ref('')
  const playbackReference = ref<StrudelPlayback | null>(null)
  const activeTab = ref<StrudelTabId | null>(null)
  const { logEntries, appendLog, clearLogEntries } = useStrudelLog()
  const playingCode = ref('')
  const playingSourceOffsets = ref<number[][]>([])
  const hasUnplayedChanges = computed(
    () => editorStatus.value === 'playing' && patternCode.value !== playingCode.value
  )
  const editorHandle = shallowRef<StrudelEditorHandle | null>(null)

  const playbackHooks = createPlaybackHooks(editorHandle, playingSourceOffsets)

  const timeline = useStrudelTimeline({ editorStatus, getPlayback: () => playbackReference.value })

  const reportError = (message: string): void => {
    editorStatus.value = 'error'
    errorMessage.value = message
    appendLog(message, 'error')
  }

  const playPattern = async (): Promise<void> => {
    errorMessage.value = ''
    appendLog('Playing pattern...')
    const evaluatedCode = patternCode.value
    try {
      const playback = await loadCachedPlayback(playbackReference, playbackLoader, playbackHooks)
      timeline.applyStartCycle()
      const evaluationResult = await playback.evaluateCode(evaluatedCode)
      if (evaluationResult.success) {
        playingCode.value = evaluatedCode
        timeline.measurePlayedPattern()
        editorStatus.value = 'playing'
        appendLog('Pattern playing')
      } else {
        // The engine keeps the previous pattern going when new code fails, which would leave
        // sound playing under a Play button; only the code on screen should ever play.
        await playback.stopPlayback()
        reportError(evaluationResult.errorMessage ?? 'Pattern failed to evaluate')
      }
    } catch (error) {
      reportError(error instanceof Error ? error.message : 'Pattern failed to evaluate')
    }
  }

  const stopPattern = async (): Promise<void> => {
    try {
      await playbackReference.value?.stopPlayback()
    } catch (error) {
      reportError(error instanceof Error ? error.message : 'Pattern failed to stop')
      return
    }
    editorStatus.value = 'idle'
    appendLog('Stopped')
  }

  const strudelExport = useStrudelExport({
    loadPlayback: () => loadCachedPlayback(playbackReference, playbackLoader, playbackHooks),
    patternCode,
    editorStatus,
    appendLog,
    activeTab
  })

  const { loadPatternCode, playLoadedPattern, loadListedPattern } = useStrudelPatternLoad({
    patternCode,
    editorStatus,
    errorMessage,
    selectedExampleId,
    stopPattern,
    playPattern,
    rewindTimeline: () => timeline.seekToCycle(0)
  })

  const selectExample = (exampleId: string): void => {
    loadListedPattern(findStrudelExample(exampleList, exampleId))
  }

  const selectElectroTune = (tuneId: string): void => {
    const matchedTune = ELECTRO_TUNES.find((tune) => tune.id === tuneId)
    if (loadListedPattern(matchedTune)) {
      appendLog(`Loaded electro tune: ${matchedTune?.label}`)
    }
  }

  const { savedPatterns, savePattern, deleteSavedPattern } = useSavedPatterns(
    () => patternCode.value
  )

  const selectPattern = (patternId: string): boolean => {
    if (ELECTRO_TUNES.some((tune) => tune.id === patternId)) {
      selectElectroTune(patternId)
      return true
    }
    return loadListedPattern(
      findStrudelExample(exampleList, patternId) ??
        savedPatterns.value.find((savedPattern) => savedPattern.id === patternId)
    )
  }

  const updatePatternCode = (nextCode: string): void => {
    patternCode.value = nextCode
  }

  const transcription = useStrudelTranscription({
    runner: editorOptions?.transcriptionRunner ?? runTranscription,
    applyCode: (transcribedCode) => {
      loadPatternCode(transcribedCode)
      void playLoadedPattern()
    },
    appendCode: (blocks) => updatePatternCode(appendStrudelFlowBlocks(patternCode.value, blocks)),
    appendLog
  })

  const setActiveTab = (tabId: StrudelTabId | null): void => {
    activeTab.value = tabId
  }

  const attachEditor = (nextEditorHandle: StrudelEditorHandle | null): void => {
    editorHandle.value = nextEditorHandle
  }

  return {
    selectedExampleId,
    patternCode,
    editorStatus,
    hasUnplayedChanges,
    playingCode,
    playingSourceOffsets,
    errorMessage,
    examples: exampleList,
    electroTunes: ELECTRO_TUNES,
    logEntries,
    activeTab,
    tabList: STRUDEL_TABS,
    selectExample,
    selectElectroTune,
    selectPattern,
    savedPatterns,
    savePattern,
    deleteSavedPattern,
    updatePatternCode,
    playPattern,
    playLoadedPattern,
    stopPattern,
    ...strudelExport,
    setActiveTab,
    appendLog,
    clearLogEntries,
    attachEditor,
    ...transcription,
    ...timeline
  }
}
