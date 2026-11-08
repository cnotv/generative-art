import {
  DEFAULT_CPS,
  EXPORT_DEFAULT_OPTIONS,
  STRUDEL_DRAW_TIME,
  STRUDEL_NO_DRAW_TIME,
  STRUDEL_SOUND_PREVIEW_LEAD_SECONDS,
  STRUDEL_SOUND_PREVIEW_NOTE,
  STRUDEL_SOUND_PREVIEW_SECONDS,
  STRUDEL_TIMELINE_MAX_LOOP_BARS
} from './config'
import {
  downloadExportFile,
  readScheduledHaps,
  renderStrudelPatternToWav
} from './strudelOfflineRender'
import { findLoopBars, findRepetitionCycles } from './patternRepetition'
import { isRecordModule, requireCallable, requireRecordModule, toCallable } from './strudelModules'
import { useInstruments } from './instruments/useInstruments'
import { loadStrudelSoundLibrary } from './strudelSoundLibrary'
import type {
  StrudelEvaluationMeta,
  StrudelEvaluationResult,
  StrudelExportFormat,
  StrudelExportOptions,
  StrudelPlayback,
  StrudelPlaybackHooks,
  StrudelPlaybackPosition,
  StrudelRenderResult,
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

const readSchedulerPosition = (scheduler: unknown): StrudelPlaybackPosition => {
  const now = isRecordModule(scheduler) ? toCallable(scheduler.now) : undefined
  const cycle: unknown = now?.call(scheduler)
  return {
    cycle: typeof cycle === 'number' ? cycle : 0,
    cyclesPerSecond: readCyclesPerSecond(scheduler)
  }
}

/**
 * Pinned `@strudel/core` 1.2.6 has no `setCycle`. Its Cyclist queries each tick from
 * `lastEnd` and re-anchors its clock to that cycle on the tick after
 * `num_ticks_since_cps_change` returns to 0, so setting both moves a running scheduler and
 * sets where a stopped one starts, since `start()` keeps `lastEnd`. `lastBegin` is what
 * `now()` counts from, set too so the playhead does not jump back until that tick.
 * @param scheduler - the REPL's Cyclist
 * @param cycle - the cycle to play from
 */
const seekScheduler = (scheduler: unknown, cycle: number): void => {
  if (!isRecordModule(scheduler)) {
    return
  }
  Reflect.set(scheduler, 'lastEnd', cycle)
  Reflect.set(scheduler, 'lastBegin', cycle)
  Reflect.set(scheduler, 'num_ticks_since_cps_change', 0)
}
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

// Instrument presets render only when code plays one of their sounds, so the pattern waits for
// them. A failure is recorded on the preset and leaves the rest of the pattern playing.
const prepareInstrumentsForCode = async (patternCode: string): Promise<void> => {
  try {
    await useInstruments().ensureRenderedForCode(patternCode)
  } catch {
    // Without an active store there are no presets to wait for.
  }
}

const toUnknownList = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])

/**
 * Where in the evaluated code each sounding note comes from: the start of every location of
 * the hap. Strudel does not list the head of a chain first for chained controls, so the caller
 * picks the leftmost owner.
 * @param haps - the haps sounding now
 * @returns one list of source offsets per hap that has locations
 */
export const readHapSourceOffsets = (haps: unknown[]): number[][] =>
  haps.flatMap((hap) => {
    const context = isRecordModule(hap) ? hap.context : undefined
    const locations = isRecordModule(context) ? toUnknownList(context.locations) : []
    const starts = locations.flatMap((location) =>
      isRecordModule(location) && typeof location.start === 'number' ? [location.start] : []
    )
    return starts.length === 0 ? [] : [starts]
  })

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
 * Evaluates code and renders it, handing back the file or the reason it failed rather than
 * downloading it.
 * @param evaluate - evaluates the code without playing it
 * @param render - renders an evaluated pattern to a WAV file
 * @returns the file, or the error message
 */
const renderWavBytes = async (
  evaluate: () => Promise<unknown>,
  render: (pattern: unknown) => Promise<ArrayBuffer>
): Promise<StrudelRenderResult> => {
  try {
    return { success: true, file: await render(await evaluate()) }
  } catch (error) {
    return { success: false, errorMessage: describeError(error) }
  }
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
  let latestPattern: unknown = null
  const callbacks: ReplCallbacks = {
    beforeEval: cleanupVisuals,
    // The REPL reports a failed evaluation here and never rejects, so a typo would
    // otherwise read as playing.
    onEvalError: (error) => {
      latestEvaluationError = error
    },
    afterEval: (evaluation) => {
      latestPattern = isRecordModule(evaluation) ? (evaluation.pattern ?? null) : null
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
    await prepareInstrumentsForCode(patternCode)
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
      await prepareInstrumentsForCode(patternCode)
      latestEvaluationError = null
      await evaluateFunction(patternCode)
      return latestEvaluationError === null
        ? { success: true }
        : { success: false, errorMessage: describeError(latestEvaluationError) }
    },
    stopPlayback: async (): Promise<void> => {
      await stopFunction()
    },
    readPosition: () => readSchedulerPosition(replScheduler),
    seekToCycle: (cycle: number) => seekScheduler(replScheduler, cycle),
    measureLoop: (): number | null =>
      latestPattern === null
        ? null
        : findLoopBars(
            readScheduledHaps(
              latestPattern,
              {
                ...EXPORT_DEFAULT_OPTIONS,
                startCycle: 0,
                endCycle: STRUDEL_TIMELINE_MAX_LOOP_BARS * 2
              },
              readCyclesPerSecond(replScheduler)
            ),
            STRUDEL_TIMELINE_MAX_LOOP_BARS
          ),
    measureRepetition: async (patternCode: string): Promise<number> => {
      const pattern = await evaluateForExport(patternCode)
      const cyclesPerSecond = readCyclesPerSecond(replScheduler)
      return findRepetitionCycles(
        readScheduledHaps(
          pattern,
          { ...EXPORT_DEFAULT_OPTIONS, startCycle: 0, endCycle: 1 },
          cyclesPerSecond
        )
      )
    },
    renderToWavBytes: (patternCode: string, exportOptions: StrudelExportOptions) =>
      renderWavBytes(
        () => evaluateForExport(patternCode),
        (pattern) =>
          renderStrudelPatternToWav(
            engine.audioModule,
            pattern,
            readCyclesPerSecond(replScheduler),
            exportOptions
          )
      ),
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

// Superdough fetches a sample after it has been given a start time and then drops the hap if that
// time has passed ("skip hap: still loading"), so a sample's first preview was silent. Playing it
// once at zero gain fills the cache, and the audible note is scheduled after that.
const loadedPreviewSounds = new Set<string>()

const loadPreviewSound = async (
  webaudioModule: Record<string, unknown>,
  soundValue: Record<string, unknown>
): Promise<void> => {
  // A pitched sound keeps one file per sampled note, so each note is loaded on its own.
  const soundName = `${String(soundValue.s)}:${String(soundValue.note ?? '')}:${String(soundValue.n ?? '')}`
  if (loadedPreviewSounds.has(soundName)) {
    return
  }
  const silentStart =
    readAudioTime(requireCallable(webaudioModule.getAudioContext)()) +
    STRUDEL_SOUND_PREVIEW_LEAD_SECONDS
  await requireCallable(webaudioModule.superdough)(
    { ...soundValue, gain: 0 },
    silentStart,
    STRUDEL_SOUND_PREVIEW_SECONDS
  )
  loadedPreviewSounds.add(soundName)
}

const assertAudioRunning = async (audioContext: unknown): Promise<void> => {
  await resumeAudioContext(audioContext)
  if (!isRecordModule(audioContext) || audioContext.state !== 'running') {
    throw new Error('The browser has not allowed audio yet. Click again to hear it.')
  }
}

/**
 * Gets the engine ready to play a preview. Unlocks the page's audio first, synchronously inside
 * the click, for the same iOS reason Play does, then waits for every sound to be registered.
 * @returns the engine module
 * @throws {Error} when the browser keeps the audio context suspended, so the preview would be silent
 */
const prepareStrudelPreview = async (): Promise<Record<string, unknown>> => {
  const gestureAudioContext = unlockPageAudioContext()
  const webaudioModule = requireRecordModule(await import('@strudel/webaudio'))
  if (gestureAudioContext !== null) {
    requireCallable(webaudioModule.setAudioContext)(gestureAudioContext)
  }
  await requireCallable(webaudioModule.initAudio)()
  await loadStrudelSoundLibrary()
  await assertAudioRunning(requireCallable(webaudioModule.getAudioContext)())
  return webaudioModule
}

const readPreviewStartTime = (webaudioModule: Record<string, unknown>): number =>
  readAudioTime(requireCallable(webaudioModule.getAudioContext)()) +
  STRUDEL_SOUND_PREVIEW_LEAD_SECONDS

/**
 * The value superdough plays for one picked sound. Strudel's own `s` control splits `name:2` into
 * the sound and its sample index, but superdough takes the two apart, so the index is split here.
 * @param soundName - a registered sound, with an optional sample index such as "chainsaw:1"
 * @param soundType - its registration type; synths and soundfonts are given a note to play
 * @returns the sound, its index when there is one, a note when the type needs one, and a clip
 */
export const readPreviewSoundValue = (
  soundName: string,
  soundType: string
): Record<string, unknown> => {
  const [sampleName = soundName, sampleIndex] = soundName.split(':')
  const needsNote = soundType === 'synth' || soundType === 'soundfont'
  return {
    s: sampleName,
    n: sampleIndex === undefined || sampleIndex === '' ? undefined : Number(sampleIndex),
    note: needsNote ? STRUDEL_SOUND_PREVIEW_NOTE : undefined,
    clip: 1
  }
}

/**
 * Plays one sound on its own, as clicking a name in strudel.cc's sounds tab does.
 * @param soundName - a registered sound, such as "bd" or "gm_piano", with an optional ":index"
 * @param soundType - its registration type; synths and soundfonts are given a note to play
 * @throws {Error} when the browser keeps the audio context suspended, so the sound would be silent
 */
export const previewStrudelSound = async (soundName: string, soundType: string): Promise<void> => {
  const webaudioModule = await prepareStrudelPreview()
  // Quoted, since the scan finds a bare preset name only inside a pattern string.
  await prepareInstrumentsForCode(`s("${soundName}")`)
  const soundValue = readPreviewSoundValue(soundName, soundType)
  await loadPreviewSound(webaudioModule, soundValue)
  await requireCallable(webaudioModule.superdough)(
    soundValue,
    readPreviewStartTime(webaudioModule),
    STRUDEL_SOUND_PREVIEW_SECONDS
  )
}

const SILENT_PLAYBACK_HOOKS: StrudelPlaybackHooks = {
  onEvaluated: () => undefined,
  onFrame: () => undefined,
  onStopped: () => undefined,
  getDrawContext: () => null
}

const silentPlayback: { loading: Promise<StrudelPlayback> | null } = { loading: null }

const loadSilentPlayback = (): Promise<StrudelPlayback> => {
  silentPlayback.loading ??= loadDefaultStrudelPlayback(SILENT_PLAYBACK_HOOKS).catch(
    (error: unknown) => {
      silentPlayback.loading = null
      throw error
    }
  )
  return silentPlayback.loading
}

/**
 * Renders code offline to a WAV file, outside the editor's own playback, so the Instruments tab
 * can make a preview without touching what is in the code editor.
 * @param patternCode - Strudel code that sets its own tempo and plays one cycle
 * @returns the WAV file
 * @throws {Error} when the code does not render
 */
export const renderStrudelCodeToWav = async (patternCode: string): Promise<ArrayBuffer> => {
  await prepareInstrumentsForCode(patternCode)
  const playback = await loadSilentPlayback()
  const result = await playback.renderToWavBytes(patternCode, EXPORT_DEFAULT_OPTIONS)
  if (!result.success || result.file === undefined) {
    throw new Error(result.errorMessage ?? 'The code did not render.')
  }
  return result.file
}

/**
 * Plays a rendered WAV once on the page's audio and hands back a way to stop it. One buffer,
 * unlike sounds scheduled one by one, can be stopped at any moment. The audio is unlocked
 * before anything is awaited, so call it straight from the click.
 * @param loadWav - gives the file to play, rendering it if needed
 * @param onEnded - called once when it finishes or is stopped
 * @returns a function that stops it
 * @throws {Error} when the browser keeps the audio context suspended, so it would be silent
 */
export const playStrudelWavPreview = async (
  loadWav: () => Promise<ArrayBuffer>,
  onEnded: () => void
): Promise<() => void> => {
  const audioContext = unlockPageAudioContext()
  if (audioContext === null) {
    throw new Error('This browser has no Web Audio.')
  }
  const wav = await loadWav()
  await assertAudioRunning(audioContext)
  // decodeAudioData detaches the buffer it is given, and the caller keeps its copy for later.
  const audioBuffer = await audioContext.decodeAudioData(structuredClone(wav))
  const source = audioContext.createBufferSource()
  source.buffer = audioBuffer
  source.connect(audioContext.destination)
  source.addEventListener('ended', onEnded, { once: true })
  source.start()
  return () => source.stop()
}
