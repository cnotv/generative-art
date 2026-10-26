import { DEFAULT_SAMPLE_BANK, STRUDEL_DRAW_TIME, STRUDEL_NO_DRAW_TIME } from './config'
import type {
  StrudelEvaluationMeta,
  StrudelEvaluationResult,
  StrudelPlayback,
  StrudelPlaybackHooks
} from './types'

type UnknownCallable = (...callArguments: unknown[]) => unknown

type ReplCallbacks = {
  beforeEval: () => void
  onEvalError: (error: unknown) => void
  afterEval: (evaluation: unknown) => void
  onToggle: (started: unknown) => void
}

type StrudelEngine = {
  replFactory: UnknownCallable
  scopeInitializer: UnknownCallable
  audioInitializer: UnknownCallable
  synthRegistrar: UnknownCallable
  sampleBankLoader: UnknownCallable
  contextGetter: UnknownCallable
  scheduleHandler: unknown
  codeTranspiler: unknown
  scopeModules: unknown[]
}

const isRecordModule = (moduleValue: unknown): moduleValue is Record<string, unknown> =>
  typeof moduleValue === 'object' && moduleValue !== null

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

const toUnknownList = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])

/**
 * Where the transpiler found mini-notation and widgets in the code just evaluated.
 * @param evaluation - the object the REPL hands to afterEval
 * @returns the locations and widget configs, empty when absent
 */
export const readEvaluationMeta = (evaluation: unknown): StrudelEvaluationMeta => {
  const meta = isRecordModule(evaluation) ? evaluation.meta : undefined
  return isRecordModule(meta)
    ? { miniLocations: toUnknownList(meta.miniLocations), widgets: toUnknownList(meta.widgets) }
    : { miniLocations: [], widgets: [] }
}

const patternHasPainters = (evaluation: unknown): boolean => {
  const pattern = isRecordModule(evaluation) ? evaluation.pattern : undefined
  const getPainters = isRecordModule(pattern) ? toCallable(pattern.getPainters) : undefined
  return getPainters !== undefined && toUnknownList(getPainters.call(pattern)).length > 0
}

const isActiveAt =
  (time: number) =>
  (hap: unknown): boolean => {
    const isActive = isRecordModule(hap) ? toCallable(hap.isActive) : undefined
    return isActive !== undefined && isActive.call(hap, time) === true
  }

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : 'Pattern failed to evaluate'

const loadStrudelEngine = async (): Promise<StrudelEngine> => {
  const [
    coreModule,
    miniModule,
    webaudioModule,
    tonalModule,
    transpilerModule,
    drawModule
  ]: unknown[] = await Promise.all([
    import('@strudel/core'),
    import('@strudel/mini'),
    import('@strudel/webaudio'),
    import('@strudel/tonal'),
    import('@strudel/transpiler'),
    import('@strudel/draw')
  ])
  // Importing the editor module registers _pianoroll, _scope and the other inline widgets
  // with the transpiler, and supplies the sliderWithID that slider() is rewritten into.
  const { slider, sliderWithID } = await import('@strudel/codemirror')
  if (
    !isRecordModule(coreModule) ||
    !isRecordModule(webaudioModule) ||
    !isRecordModule(transpilerModule)
  ) {
    throw new Error('Strudel modules failed to load')
  }
  const engine = {
    replFactory: toCallable(coreModule.repl),
    scopeInitializer: toCallable(coreModule.evalScope),
    audioInitializer: toCallable(webaudioModule.initAudio),
    synthRegistrar: toCallable(webaudioModule.registerSynthSounds),
    sampleBankLoader: toCallable(webaudioModule.samples),
    contextGetter: toCallable(webaudioModule.getAudioContext),
    scheduleHandler: webaudioModule.webaudioOutput,
    codeTranspiler: transpilerModule.transpiler,
    scopeModules: [
      miniModule,
      webaudioModule,
      tonalModule,
      coreModule,
      drawModule,
      { slider, sliderWithID }
    ]
  }
  const {
    replFactory,
    scopeInitializer,
    audioInitializer,
    synthRegistrar,
    sampleBankLoader,
    contextGetter
  } = engine
  if (
    replFactory === undefined ||
    scopeInitializer === undefined ||
    audioInitializer === undefined ||
    synthRegistrar === undefined ||
    sampleBankLoader === undefined ||
    contextGetter === undefined ||
    typeof engine.scheduleHandler !== 'function' ||
    typeof engine.codeTranspiler !== 'function'
  ) {
    throw new Error('Strudel modules failed to load')
  }
  return {
    ...engine,
    replFactory,
    scopeInitializer,
    audioInitializer,
    synthRegistrar,
    sampleBankLoader,
    contextGetter
  }
}

/**
 * Runs pianoroll and scope painters and moves the playhead highlight each frame. The
 * painters only draw once a canvas exists: given none, `@strudel/draw` falls back to a
 * full-window canvas pinned over the whole page.
 * @param hooks - the editor callbacks to report frames to
 * @returns the Drawer, started and stopped with the scheduler
 */
/**
 * `.pianoroll()`, `.scope()` and the other visuals each run their own animation, which an
 * evaluation that no longer calls them never stops, so they kept drawing after their code was
 * gone. strudel.cc clears them before every evaluation and on stop, and so does this; only
 * while the editor's canvas exists, since `cleanupDraw` puts a full-window canvas over the
 * page when it finds none.
 * @param hooks - the editor callbacks, which report whether its canvas is there
 * @returns a function that stops and clears every visual
 */
const createVisualsCleanup = async (hooks: StrudelPlaybackHooks): Promise<() => void> => {
  const { cleanupDraw } = await import('@strudel/draw')
  return () => {
    if (hooks.getDrawContext() !== null) {
      cleanupDraw(true)
    }
  }
}

const createPlaybackDrawer = async (hooks: StrudelPlaybackHooks) => {
  const { Drawer } = await import('@strudel/draw')
  return new Drawer((haps, time, _drawer, painters) => {
    hooks.onFrame(haps.filter(isActiveAt(time)), time)
    const drawContext = hooks.getDrawContext()
    if (drawContext === null) {
      return
    }
    painters.forEach((painter) => toCallable(painter)?.(drawContext, time, haps, STRUDEL_DRAW_TIME))
  }, STRUDEL_DRAW_TIME)
}

/**
 * Loads the Strudel engine on demand, starts audio, loads the default sample kit and
 * returns a playback handle around one REPL (read-eval-print loop) instance. Evaluations
 * report their sliders and widgets, and every frame its playing notes, to the hooks.
 * @param hooks - where the editor receives evaluations, frames and the drawing canvas
 * @returns functions to evaluate code and stop playback
 */
export const loadDefaultStrudelPlayback = async (
  hooks: StrudelPlaybackHooks
): Promise<StrudelPlayback> => {
  const engine = await loadStrudelEngine()
  await engine.audioInitializer()
  engine.synthRegistrar()
  const audioContext: unknown = await engine.contextGetter()
  await resumeAudioContext(audioContext)
  await engine.sampleBankLoader(DEFAULT_SAMPLE_BANK)
  await engine.scopeInitializer(...engine.scopeModules)
  const drawer = await createPlaybackDrawer(hooks)
  const cleanupVisuals = await createVisualsCleanup(hooks)
  let replScheduler: unknown = null
  let latestEvaluationError: unknown = null
  const callbacks: ReplCallbacks = {
    beforeEval: cleanupVisuals,
    // The REPL reports a failed evaluation here and never rejects, so a typo would
    // otherwise read as playing.
    onEvalError: (error) => {
      latestEvaluationError = error
    },
    afterEval: (evaluation) => {
      hooks.onEvaluated(readEvaluationMeta(evaluation))
      drawer.setDrawTime(patternHasPainters(evaluation) ? STRUDEL_DRAW_TIME : STRUDEL_NO_DRAW_TIME)
      drawer.invalidate(replScheduler)
    },
    onToggle: (started) => {
      if (started === true) {
        drawer.start(replScheduler)
        return
      }
      drawer.stop()
      cleanupVisuals()
      hooks.onStopped()
    }
  }
  const replInstance: unknown = await engine.replFactory({
    // Pinned @strudel/core 1.2.6 schedules through defaultOutput; newer Strudel renamed
    // it to onSchedule, so this key has to move with the pinned version.
    defaultOutput: engine.scheduleHandler,
    getTime: () => readAudioTime(audioContext),
    transpiler: engine.codeTranspiler,
    ...callbacks
  })
  if (!isRecordModule(replInstance)) {
    throw new Error('Strudel modules failed to load')
  }
  replScheduler = replInstance.scheduler
  const evaluateFunction = toCallable(replInstance.evaluate)
  const stopFunction = toCallable(replInstance.stop)
  if (evaluateFunction === undefined || stopFunction === undefined) {
    throw new Error('Strudel modules failed to load')
  }

  return {
    evaluateCode: async (patternCode: string): Promise<StrudelEvaluationResult> => {
      latestEvaluationError = null
      await evaluateFunction(patternCode)
      return latestEvaluationError === null
        ? { success: true }
        : { success: false, errorMessage: describeError(latestEvaluationError) }
    },
    stopPlayback: async (): Promise<void> => {
      await stopFunction()
    }
  }
}
