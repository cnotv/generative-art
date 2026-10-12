import { ref } from 'vue'
import type { Ref } from 'vue'
import { DEFAULT_STRUDEL_EXAMPLE_ID, STRUDEL_EXAMPLES } from './config'
import type {
  StrudelEditorStatus,
  StrudelEvaluationResult,
  StrudelExample,
  StrudelExampleOption,
  StrudelPlayback
} from './types'

export const findStrudelExample = (
  exampleList: StrudelExample[],
  exampleId: string
): StrudelExample | undefined => exampleList.find((example) => example.id === exampleId)

export const listStrudelExampleOptions = (exampleList: StrudelExample[]): StrudelExampleOption[] =>
  exampleList.map((example) => ({ value: example.id, label: example.label }))

export const resolveDefaultStrudelExample = (
  exampleList: StrudelExample[],
  defaultExampleId: string
): StrudelExample | undefined => findStrudelExample(exampleList, defaultExampleId) ?? exampleList[0]

const isRecordModule = (moduleValue: unknown): moduleValue is Record<string, unknown> =>
  typeof moduleValue === 'object' && moduleValue !== null

type UnknownCallable = (...callArguments: unknown[]) => unknown

const toCallable = (callableValue: unknown): UnknownCallable | undefined =>
  // Strudel ships untyped JS, so the shape is checked before calling.
  typeof callableValue === 'function' ? (callableValue as UnknownCallable) : undefined

const readAudioTime = (audioContext: unknown): number => {
  if (isRecordModule(audioContext) && typeof audioContext.currentTime === 'number') {
    return audioContext.currentTime
  }
  return 0
}

const resumeAudioContext = async (audioContext: unknown): Promise<void> => {
  if (!isRecordModule(audioContext)) {
    return
  }
  const resumeFunction = toCallable(audioContext.resume)
  if (resumeFunction === undefined) {
    return
  }
  await resumeFunction.call(audioContext)
}

export const loadDefaultStrudelPlayback = async (): Promise<StrudelPlayback> => {
  const [coreModule, miniModule, webaudioModule, tonalModule, transpilerModule]: unknown[] =
    await Promise.all([
      import('@strudel/core'),
      import('@strudel/mini'),
      import('@strudel/webaudio'),
      import('@strudel/tonal'),
      import('@strudel/transpiler')
    ])

  if (
    !isRecordModule(coreModule) ||
    !isRecordModule(webaudioModule) ||
    !isRecordModule(transpilerModule)
  ) {
    throw new Error('Strudel modules failed to load')
  }

  const replFactory = toCallable(coreModule.repl)
  const scopeInitializer = toCallable(coreModule.evalScope)
  const audioInitializer = toCallable(webaudioModule.initAudio)
  const synthRegistrar = toCallable(webaudioModule.registerSynthSounds)
  const contextGetter = toCallable(webaudioModule.getAudioContext)
  const scheduleHandler = webaudioModule.webaudioOutput
  const codeTranspiler = transpilerModule.transpiler
  if (
    replFactory === undefined ||
    scopeInitializer === undefined ||
    audioInitializer === undefined ||
    synthRegistrar === undefined ||
    contextGetter === undefined ||
    typeof scheduleHandler !== 'function' ||
    typeof codeTranspiler !== 'function'
  ) {
    throw new Error('Strudel modules failed to load')
  }

  await audioInitializer()
  synthRegistrar()
  await scopeInitializer(miniModule, webaudioModule, tonalModule, coreModule)

  const audioContext: unknown = await contextGetter()
  await resumeAudioContext(audioContext)
  const replInstance: unknown = await replFactory({
    // Pinned @strudel/core 1.2.6 schedules through defaultOutput; newer Strudel renamed
    // it to onSchedule, so this key has to move with the pinned version.
    defaultOutput: scheduleHandler,
    getTime: () => readAudioTime(audioContext),
    transpiler: codeTranspiler
  })
  if (!isRecordModule(replInstance)) {
    throw new Error('Strudel modules failed to load')
  }
  const evaluateFunction = toCallable(replInstance.evaluate)
  const stopFunction = toCallable(replInstance.stop)
  if (evaluateFunction === undefined || stopFunction === undefined) {
    throw new Error('Strudel modules failed to load')
  }

  return {
    evaluateCode: async (patternCode: string): Promise<StrudelEvaluationResult> => {
      await evaluateFunction(patternCode)
      return { success: true }
    },
    stopPlayback: async (): Promise<void> => {
      await stopFunction()
    }
  }
}

type StrudelEditorOptions = {
  initialExamples?: StrudelExample[]
  initialExampleId?: string
  playbackLoader?: () => Promise<StrudelPlayback>
}

type StrudelEditorState = {
  selectedExampleId: Ref<string>
  patternCode: Ref<string>
  editorStatus: Ref<StrudelEditorStatus>
  errorMessage: Ref<string>
  exampleOptions: StrudelExampleOption[]
  selectExample: (exampleId: string) => void
  updatePatternCode: (nextCode: string) => void
  playPattern: () => Promise<void>
  stopPattern: () => Promise<void>
}

const loadCachedPlayback = async (
  playbackReference: Ref<StrudelPlayback | null>,
  playbackLoader: () => Promise<StrudelPlayback>
): Promise<StrudelPlayback> => {
  if (playbackReference.value !== null) {
    return playbackReference.value
  }
  const playback = await playbackLoader()
  playbackReference.value = playback
  return playback
}

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

  const updatePatternCode = (nextCode: string): void => {
    patternCode.value = nextCode
  }

  const playPattern = async (): Promise<void> => {
    editorStatus.value = 'idle'
    errorMessage.value = ''
    try {
      const playback = await loadCachedPlayback(playbackReference, playbackLoader)
      const evaluationResult = await playback.evaluateCode(patternCode.value)
      if (evaluationResult.success) {
        editorStatus.value = 'playing'
      } else {
        editorStatus.value = 'error'
        errorMessage.value = evaluationResult.errorMessage ?? 'Pattern failed to evaluate'
      }
    } catch (error) {
      editorStatus.value = 'error'
      errorMessage.value = error instanceof Error ? error.message : 'Pattern failed to evaluate'
    }
  }

  const stopPattern = async (): Promise<void> => {
    try {
      await playbackReference.value?.stopPlayback()
    } catch (error) {
      editorStatus.value = 'error'
      errorMessage.value = error instanceof Error ? error.message : 'Pattern failed to stop'
      return
    }
    editorStatus.value = 'idle'
  }

  return {
    selectedExampleId,
    patternCode,
    editorStatus,
    errorMessage,
    exampleOptions: listStrudelExampleOptions(exampleList),
    selectExample,
    updatePatternCode,
    playPattern,
    stopPattern
  }
}
