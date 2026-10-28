import {
  DEFAULT_CPS,
  STRUDEL_DRAW_TIME,
  STRUDEL_NO_DRAW_TIME,
  STRUDEL_SOUND_PREVIEW_LEAD_SECONDS,
  STRUDEL_SOUND_PREVIEW_NOTE,
  STRUDEL_SOUND_PREVIEW_SECONDS
} from './config'
import {
  downloadExportFile,
  readScheduledHaps,
  renderStrudelPatternToWav
} from './strudelOfflineRender'
import { isRecordModule, requireCallable, requireRecordModule, toCallable } from './strudelModules'
import { loadStrudelSoundLibrary } from './strudelSoundLibrary'
import type {
  StrudelEvaluationMeta,
  StrudelEvaluationResult,
  StrudelExportFormat,
  StrudelExportOptions,
  StrudelPlayback,
  StrudelPlaybackHooks,
  StrudelUnknownCallable
} from './types'

type ReplCallbacks = {
  beforeEval: () => void
  onEvalError: (error: unknown) => void
  afterEval: (evaluation: unknown) => void
  onToggle: (started: unknown) => void
}

type StrudelEngine = {
  replFactory: StrudelUnknownCallable
  scopeInitializer: StrudelUnknownCallable
  audioInitializer: StrudelUnknownCallable
  contextGetter: StrudelUnknownCallable
  audioModule: Record<string, unknown>
  contextSetter: StrudelUnknownCallable
  scheduleHandler: unknown
  codeTranspiler: unknown
  scopeModules: unknown[]
}

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

const readCyclesPerSecond = (scheduler: unknown): number =>
  isRecordModule(scheduler) && typeof scheduler.cps === 'number' ? scheduler.cps : DEFAULT_CPS
// iOS mutes Web Audio while the ring switch is on silent unless the page declares itself a
// player. Safari 17 added this switch; older browsers have no audioSession and keep the default.
const requestPlaybackAudioSession = (): void => {
  const audioSession: unknown = Reflect.get(navigator, 'audioSession')
  if (isRecordModule(audioSession) && 'type' in audioSession) {
    Reflect.set(audioSession, 'type', 'playback')
  }
}

// Starting a one-sample silent sound is what older iOS needs, beyond resume(), to unlock audio.
const playSilentSound = (audioContext: AudioContext): void => {
  const source = audioContext.createBufferSource()
  Reflect.set(source, 'buffer', audioContext.createBuffer(1, 1, audioContext.sampleRate || 22050))
  source.connect(audioContext.destination)
  source.start(0)
}

// One context for the page, as superdough keeps one: browsers cap how many can be open, so a
// new one per visit to the editor would eventually play nothing.
const pageAudio: { context: AudioContext | null } = { context: null }

/**
 * The audio context Strudel will play through, created on the first Play and resumed on every
 * one, synchronously while the tap is still being handled. iOS lets a page start audio only
 * inside the tap, and the engine download that follows outlasts it, which left the context
 * suspended and silent.
 * @returns the unlocked context, or null where the browser has no Web Audio
 */
const unlockPageAudioContext = (): AudioContext | null => {
  if (typeof AudioContext === 'undefined') {
    return null
  }
  requestPlaybackAudioSession()
  const audioContext = pageAudio.context ?? new AudioContext()
  pageAudio.context = audioContext
  void audioContext.resume()
  playSilentSound(audioContext)
  return audioContext
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
    drawModule,
    midiModule
  ]: unknown[] = await Promise.all([
    import('@strudel/core'),
    import('@strudel/mini'),
    import('@strudel/webaudio'),
    import('@strudel/tonal'),
    import('@strudel/transpiler'),
    import('@strudel/draw'),
    import('@strudel/midi/midi.mjs')
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
  if (
    typeof webaudioModule.webaudioOutput !== 'function' ||
    typeof transpilerModule.transpiler !== 'function'
  ) {
    throw new Error('Strudel modules failed to load')
  }
  return {
    replFactory: requireCallable(coreModule.repl),
    scopeInitializer: requireCallable(coreModule.evalScope),
    audioInitializer: requireCallable(webaudioModule.initAudio),
    contextGetter: requireCallable(webaudioModule.getAudioContext),
    audioModule: webaudioModule,
    contextSetter: requireCallable(webaudioModule.setAudioContext),
    scheduleHandler: webaudioModule.webaudioOutput,
    codeTranspiler: transpilerModule.transpiler,
    scopeModules: [
      miniModule,
      webaudioModule,
      tonalModule,
      coreModule,
      drawModule,
      midiModule,
      { slider, sliderWithID }
    ]
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
  // Before the first await, so it runs inside the tap that pressed Play.
  const gestureAudioContext = unlockPageAudioContext()
  const engine = await loadStrudelEngine()
  if (gestureAudioContext !== null) {
    engine.contextSetter(gestureAudioContext)
  }
  await engine.audioInitializer()
  const audioContext: unknown = engine.contextGetter()
  await resumeAudioContext(audioContext)
  await loadStrudelSoundLibrary()
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

  // Exporting evaluates without starting the scheduler, so nothing plays while a file renders.
  const evaluateForExport = async (patternCode: string): Promise<unknown> => {
    await stopFunction()
    latestEvaluationError = null
    const pattern: unknown = await evaluateFunction(patternCode, false)
    if (latestEvaluationError !== null || pattern === undefined) {
      throw new Error(describeError(latestEvaluationError))
    }
    return pattern
  }

  const exportAs =
    (
      format: StrudelExportFormat,
      writeFile: (
        pattern: unknown,
        cyclesPerSecond: number,
        exportOptions: StrudelExportOptions
      ) => Promise<ArrayBuffer | Uint8Array<ArrayBuffer>>
    ) =>
    async (
      patternCode: string,
      exportOptions: StrudelExportOptions
    ): Promise<StrudelEvaluationResult> => {
      try {
        const pattern = await evaluateForExport(patternCode)
        const file = await writeFile(pattern, readCyclesPerSecond(replScheduler), exportOptions)
        downloadExportFile(file, exportOptions.fileName, format)
        return { success: true }
      } catch (error) {
        return { success: false, errorMessage: describeError(error) }
      }
    }

  return {
    evaluateCode: async (patternCode: string): Promise<StrudelEvaluationResult> => {
      // Each Play or Update is a tap, and iOS may have suspended the context since the last.
      void resumeAudioContext(audioContext)
      latestEvaluationError = null
      await evaluateFunction(patternCode)
      return latestEvaluationError === null
        ? { success: true }
        : { success: false, errorMessage: describeError(latestEvaluationError) }
    },
    stopPlayback: async (): Promise<void> => {
      await stopFunction()
    },
    renderToWav: exportAs('wav', (pattern, cyclesPerSecond, exportOptions) =>
      renderStrudelPatternToWav(engine.audioModule, pattern, cyclesPerSecond, exportOptions)
    ),
    renderToMidi: exportAs('midi', async (pattern, cyclesPerSecond, exportOptions) => {
      const { buildPatternMidi } = await import('./patternMidi')
      return buildPatternMidi(readScheduledHaps(pattern, exportOptions, cyclesPerSecond), {
        beginCycle: exportOptions.startCycle,
        cyclesPerSecond
      })
    })
  }
}

/**
 * Plays one sound on its own, as clicking a name in strudel.cc's sounds tab does. Unlocks the
 * page's audio first, inside the click, for the same iOS reason Play does.
 * @param soundName - a registered sound, such as "bd" or "gm_piano"
 * @param soundType - its registration type; synths and soundfonts are given a note to play
 */
export const previewStrudelSound = async (soundName: string, soundType: string): Promise<void> => {
  const gestureAudioContext = unlockPageAudioContext()
  const webaudioModule = requireRecordModule(await import('@strudel/webaudio'))
  if (gestureAudioContext !== null) {
    requireCallable(webaudioModule.setAudioContext)(gestureAudioContext)
  }
  await requireCallable(webaudioModule.initAudio)()
  await loadStrudelSoundLibrary()
  const needsNote = soundType === 'synth' || soundType === 'soundfont'
  const soundValue = {
    s: soundName,
    note: needsNote ? STRUDEL_SOUND_PREVIEW_NOTE : undefined,
    clip: 1
  }
  const startTime =
    readAudioTime(requireCallable(webaudioModule.getAudioContext)()) +
    STRUDEL_SOUND_PREVIEW_LEAD_SECONDS
  await requireCallable(webaudioModule.superdough)(
    soundValue,
    startTime,
    STRUDEL_SOUND_PREVIEW_SECONDS
  )
}
