import { ref, shallowRef } from 'vue'
import type { Ref } from 'vue'
import { DEFAULT_STRUDEL_EXAMPLE_ID, ELECTRO_TUNES, STRUDEL_EXAMPLES, STRUDEL_TABS } from './config'
import type {
  StrudelEditorHandle,
  StrudelEditorStatus,
  StrudelExample,
  StrudelExampleOption,
  StrudelLogEntry,
  StrudelPlayback,
  StrudelPlaybackHooks,
  StrudelPlaybackLoader,
  StrudelTabId,
  StrudelTranscriptionState,
  TranscriptionRunner
} from './types'
import { loadDefaultStrudelPlayback } from './strudelPlayback'
import { runTranscriptionInWorker } from './transcription/runTranscription'
import { useStrudelTranscription } from './transcription/useStrudelTranscription'

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
 * Select options for the example picker.
 * @param exampleList - examples to list
 * @returns one option per example
 */
export const listStrudelExampleOptions = (exampleList: StrudelExample[]): StrudelExampleOption[] =>
  exampleList.map((example) => ({ value: example.id, label: example.label }))

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
  errorMessage: Ref<string>
  exampleOptions: StrudelExampleOption[]
  examples: StrudelExample[]
  electroTunes: StrudelExample[]
  logEntries: Ref<StrudelLogEntry[]>
  activeTab: Ref<StrudelTabId>
  tabList: { id: StrudelTabId; label: string }[]
  selectExample: (exampleId: string) => void
  selectElectroTune: (tuneId: string) => void
  /** Loads the example or tune with this id; false when neither has it. */
  selectPattern: (patternId: string) => boolean
  updatePatternCode: (nextCode: string) => void
  playPattern: () => Promise<void>
  stopPattern: () => Promise<void>
  setActiveTab: (tabId: StrudelTabId) => void
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

/**
 * Editor state: the selected example, the code, playback, the console log, the active tab
 * and audio transcription.
 * @param editorOptions - examples, playback loader and transcription runner, for tests
 * @returns reactive editor state and its actions
 */
export const useStrudelEditor = (editorOptions?: StrudelEditorOptions): StrudelEditorState => {
  const exampleList = editorOptions?.initialExamples ?? STRUDEL_EXAMPLES
  const defaultExample =
    resolveDefaultStrudelExample(
      exampleList,
      editorOptions?.initialExampleId ?? DEFAULT_STRUDEL_EXAMPLE_ID
    ) ?? exampleList[0]
  const playbackLoader = editorOptions?.playbackLoader ?? loadDefaultStrudelPlayback

  const selectedExampleId = ref(defaultExample?.id ?? '')
  const patternCode = ref(defaultExample?.code ?? '')
  const editorStatus = ref<StrudelEditorStatus>('idle')
  const errorMessage = ref('')
  const playbackReference = ref<StrudelPlayback | null>(null)
  const activeTab = ref<StrudelTabId>('welcome')
  const logEntries = ref<StrudelLogEntry[]>([])
  const editorHandle = shallowRef<StrudelEditorHandle | null>(null)
  let logCounter = 0

  // Playback outlives any one editor instance, so it reaches the editor through this ref.
  const playbackHooks: StrudelPlaybackHooks = {
    onEvaluated: (meta) => editorHandle.value?.applyEvaluation(meta),
    onFrame: (activeHaps, time) => editorHandle.value?.highlight(activeHaps, time),
    onStopped: () => {
      editorHandle.value?.clearHighlights()
      editorHandle.value?.clearVisuals()
    },
    getDrawContext: () => editorHandle.value?.getDrawContext() ?? null
  }

  const appendLog = (message: string, level: StrudelLogEntry['level'] = 'info'): void => {
    logCounter += 1
    logEntries.value = [...logEntries.value, { id: logCounter, message, level }]
  }

  const selectExample = (exampleId: string): void => {
    const matchedExample = findStrudelExample(exampleList, exampleId)
    if (matchedExample === undefined) {
      return
    }
    selectedExampleId.value = matchedExample.id
    patternCode.value = matchedExample.code
    editorStatus.value = 'idle'
    errorMessage.value = ''
  }

  const selectElectroTune = (tuneId: string): void => {
    const matchedTune = ELECTRO_TUNES.find((tune) => tune.id === tuneId)
    if (matchedTune === undefined) {
      return
    }
    selectedExampleId.value = matchedTune.id
    patternCode.value = matchedTune.code
    editorStatus.value = 'idle'
    errorMessage.value = ''
    appendLog(`Loaded electro tune: ${matchedTune.label}`)
  }

  const selectPattern = (patternId: string): boolean => {
    if (findStrudelExample(exampleList, patternId) !== undefined) {
      selectExample(patternId)
      return true
    }
    if (ELECTRO_TUNES.some((tune) => tune.id === patternId)) {
      selectElectroTune(patternId)
      return true
    }
    return false
  }

  const updatePatternCode = (nextCode: string): void => {
    patternCode.value = nextCode
  }

  const playPattern = async (): Promise<void> => {
    editorStatus.value = 'idle'
    errorMessage.value = ''
    appendLog('Playing pattern...')
    try {
      const playback = await loadCachedPlayback(playbackReference, playbackLoader, playbackHooks)
      const evaluationResult = await playback.evaluateCode(patternCode.value)
      if (evaluationResult.success) {
        editorStatus.value = 'playing'
        appendLog('Pattern playing')
      } else {
        editorStatus.value = 'error'
        errorMessage.value = evaluationResult.errorMessage ?? 'Pattern failed to evaluate'
        appendLog(errorMessage.value, 'error')
      }
    } catch (error) {
      editorStatus.value = 'error'
      errorMessage.value = error instanceof Error ? error.message : 'Pattern failed to evaluate'
      appendLog(errorMessage.value, 'error')
    }
  }

  const stopPattern = async (): Promise<void> => {
    try {
      await playbackReference.value?.stopPlayback()
    } catch (error) {
      editorStatus.value = 'error'
      errorMessage.value = error instanceof Error ? error.message : 'Pattern failed to stop'
      appendLog(errorMessage.value, 'error')
      return
    }
    editorStatus.value = 'idle'
    appendLog('Stopped')
  }

  const transcription = useStrudelTranscription({
    runner: editorOptions?.transcriptionRunner ?? runTranscriptionInWorker,
    applyCode: (transcribedCode) => {
      patternCode.value = transcribedCode
      editorStatus.value = 'idle'
      errorMessage.value = ''
    },
    appendLog
  })

  const setActiveTab = (tabId: StrudelTabId): void => {
    activeTab.value = tabId
  }

  const clearLogEntries = (): void => {
    logEntries.value = []
  }

  const attachEditor = (nextEditorHandle: StrudelEditorHandle | null): void => {
    editorHandle.value = nextEditorHandle
  }

  return {
    selectedExampleId,
    patternCode,
    editorStatus,
    errorMessage,
    exampleOptions: listStrudelExampleOptions(exampleList),
    examples: exampleList,
    electroTunes: ELECTRO_TUNES,
    logEntries,
    activeTab,
    tabList: STRUDEL_TABS,
    selectExample,
    selectElectroTune,
    selectPattern,
    updatePatternCode,
    playPattern,
    stopPattern,
    setActiveTab,
    clearLogEntries,
    attachEditor,
    ...transcription
  }
}
