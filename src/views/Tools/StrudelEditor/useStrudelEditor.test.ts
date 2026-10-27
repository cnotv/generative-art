import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import {
  DEFAULT_SAMPLE_BANK,
  DEFAULT_STRUDEL_EXAMPLE_ID,
  STRUDEL_SAVED_CODE_STORAGE_KEY,
  STRUDEL_SAVED_PATTERNS_STORAGE_KEY,
  ELECTRO_TUNES,
  STRUDEL_EXAMPLES,
  STRUDEL_TABS
} from './config'
import type {
  StrudelEditorHandle,
  StrudelExample,
  StrudelPlayback,
  StrudelPlaybackHooks
} from './types'
import { loadDefaultStrudelPlayback } from './strudelPlayback'
import {
  findStrudelExample,
  resolveDefaultStrudelExample,
  useStrudelEditor
} from './useStrudelEditor'

const {
  mockReplFactory,
  mockScopeInitializer,
  mockAudioInitializer,
  mockSynthRegistrar,
  mockSampleBankLoader,
  mockContextGetter,
  mockContextSetter,
  mockResumeFunction,
  mockScheduleHandler,
  mockCodeTranspiler,
  mockEvaluateFunction,
  mockStopFunction,
  mockDrawer,
  mockDrawerConstructor,
  mockCleanupDraw,
  mockSlider,
  mockSliderWithId,
  mockOfflineRender,
  mockWavDownload
} = vi.hoisted(() => {
  const drawer = {
    start: vi.fn(),
    stop: vi.fn(),
    setDrawTime: vi.fn(),
    invalidate: vi.fn()
  }
  // The loader calls `new Drawer(...)`, and an arrow function cannot be constructed.
  function createDrawer() {
    return drawer
  }
  return {
    mockDrawer: drawer,
    mockDrawerConstructor: vi.fn(createDrawer),
    mockCleanupDraw: vi.fn(),
    mockSlider: vi.fn(),
    mockSliderWithId: vi.fn(),
    mockReplFactory: vi.fn(),
    mockScopeInitializer: vi.fn(),
    mockAudioInitializer: vi.fn(),
    mockSynthRegistrar: vi.fn(),
    mockSampleBankLoader: vi.fn(),
    mockContextGetter: vi.fn(),
    mockContextSetter: vi.fn(),
    mockResumeFunction: vi.fn(),
    mockScheduleHandler: vi.fn(),
    mockCodeTranspiler: vi.fn(),
    mockEvaluateFunction: vi.fn(),
    mockStopFunction: vi.fn(),
    mockOfflineRender: vi.fn(),
    mockWavDownload: vi.fn()
  }
})

vi.mock('@strudel/core', () => ({
  repl: mockReplFactory,
  evalScope: mockScopeInitializer
}))
vi.mock('@strudel/mini', () => ({}))
vi.mock('@strudel/webaudio', () => ({
  initAudio: mockAudioInitializer,
  registerSynthSounds: mockSynthRegistrar,
  samples: mockSampleBankLoader,
  getAudioContext: mockContextGetter,
  setAudioContext: mockContextSetter,
  webaudioOutput: mockScheduleHandler
}))
vi.mock('@strudel/tonal', () => ({}))
vi.mock('@strudel/midi/midi.mjs', () => ({}))
vi.mock('./strudelOfflineRender', () => ({
  renderStrudelPatternToWav: mockOfflineRender,
  downloadWavFile: mockWavDownload
}))
vi.mock('@strudel/transpiler', () => ({
  transpiler: mockCodeTranspiler
}))
vi.mock('@strudel/draw', () => ({
  Drawer: mockDrawerConstructor,
  cleanupDraw: mockCleanupDraw
}))
vi.mock('@strudel/codemirror', () => ({
  slider: mockSlider,
  sliderWithID: mockSliderWithId
}))

type GestureAudioContext = {
  resume: ReturnType<typeof vi.fn>
  createBuffer: ReturnType<typeof vi.fn>
  createBufferSource: ReturnType<typeof vi.fn>
  destination: object
}

// jsdom has no Web Audio, so the context the loader creates in the tap is a recording stand-in.
const createAudioContextStub = (createdContexts: GestureAudioContext[]) =>
  function AudioContextStub(this: GestureAudioContext) {
    this.resume = vi.fn(async () => undefined)
    this.createBuffer = vi.fn(() => ({}))
    this.createBufferSource = vi.fn(() => ({ connect: vi.fn(), start: vi.fn() }))
    this.destination = {}
    createdContexts.push(this)
  }

const buildPlaybackHooks = (): StrudelPlaybackHooks => ({
  onEvaluated: vi.fn(),
  onFrame: vi.fn(),
  onStopped: vi.fn(),
  getDrawContext: vi.fn(() => null)
})

const readReplOptions = (): Record<string, unknown> => {
  const replOptions: unknown = mockReplFactory.mock.calls[0]?.[0]
  return typeof replOptions === 'object' && replOptions !== null
    ? Object.fromEntries(Object.entries(replOptions))
    : {}
}

const callReplOption = (optionName: string, ...callArguments: unknown[]): void => {
  const option = readReplOptions()[optionName]
  if (typeof option === 'function') {
    option(...callArguments)
  }
}

const buildExampleList = (): StrudelExample[] => [
  { id: 'first-beat', label: 'First beat', code: 's("bd sd")' },
  { id: 'four-floor', label: 'Four floor', code: 's("bd*4")' }
]

const buildSuccessfulPlayback = (): StrudelPlayback => ({
  evaluateCode: vi.fn(async () => ({ success: true })),
  stopPlayback: vi.fn(async () => {}),
  renderToWav: vi.fn(async () => ({ success: true }))
})

describe('findStrudelExample', () => {
  it('returns the matching example', () => {
    // Arrange
    const exampleList = buildExampleList()

    // Act
    const matchedExample = findStrudelExample(exampleList, 'four-floor')

    // Assert
    expect(matchedExample?.code).toBe('s("bd*4")')
  })

  it('returns undefined for an unknown id', () => {
    // Arrange
    const exampleList = buildExampleList()

    // Act
    const matchedExample = findStrudelExample(exampleList, 'missing-pattern')

    // Assert
    expect(matchedExample).toBeUndefined()
  })
})

describe('resolveDefaultStrudelExample', () => {
  it('resolves the configured default', () => {
    // Arrange
    const exampleList = buildExampleList()

    // Act
    const defaultExample = resolveDefaultStrudelExample(exampleList, 'four-floor')

    // Assert
    expect(defaultExample?.id).toBe('four-floor')
  })

  it('falls back to the first example when the default is gone', () => {
    // Arrange
    const exampleList = buildExampleList()

    // Act
    const defaultExample = resolveDefaultStrudelExample(exampleList, 'missing-pattern')

    // Assert
    expect(defaultExample?.id).toBe('first-beat')
  })

  it('resolves the shipped default from the shipped examples', () => {
    // Arrange
    const exampleId = DEFAULT_STRUDEL_EXAMPLE_ID

    // Act
    const defaultExample = resolveDefaultStrudelExample(STRUDEL_EXAMPLES, exampleId)

    // Assert
    expect(defaultExample?.id).toBe(exampleId)
  })
})

describe('loadDefaultStrudelPlayback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEvaluateFunction.mockResolvedValue(undefined)
    mockContextGetter.mockReturnValue({ currentTime: 0, resume: mockResumeFunction })
    mockReplFactory.mockResolvedValue({
      evaluate: mockEvaluateFunction,
      stop: mockStopFunction
    })
  })

  it('renders the evaluated pattern offline at its tempo and downloads the file', async () => {
    // Arrange
    const pattern = { kind: 'pattern' }
    const wavFile = new ArrayBuffer(8)
    mockOfflineRender.mockResolvedValue(wavFile)
    mockEvaluateFunction.mockResolvedValue(pattern)
    mockReplFactory.mockResolvedValue({
      evaluate: mockEvaluateFunction,
      stop: mockStopFunction,
      scheduler: { cps: 0.75 }
    })
    const playback = await loadDefaultStrudelPlayback(buildPlaybackHooks())
    const exportOptions = { startCycle: 1, endCycle: 3, sampleRate: 44100, fileName: 'loop' }

    // Act
    const result = await playback.renderToWav('s("bd")', exportOptions)

    // Assert
    expect(result).toEqual({ success: true })
    expect(mockStopFunction).toHaveBeenCalled()
    expect(mockEvaluateFunction).toHaveBeenCalledWith('s("bd")', false)
    expect(mockOfflineRender).toHaveBeenCalledWith(
      expect.objectContaining({ initAudio: mockAudioInitializer }),
      pattern,
      0.75,
      exportOptions
    )
    expect(mockWavDownload).toHaveBeenCalledWith(wavFile, 'loop')
  })

  it('hands the scheduler output to the pinned core under defaultOutput', async () => {
    // Arrange
    const playbackLoader = loadDefaultStrudelPlayback

    // Act
    await playbackLoader(buildPlaybackHooks())
    const replOptions = mockReplFactory.mock.calls[0]?.[0] as Record<string, unknown>

    // Assert
    expect(replOptions.defaultOutput).toBe(mockScheduleHandler)
    expect(replOptions).not.toHaveProperty('onSchedule')
  })

  it('initializes and resumes audio inside the play gesture', async () => {
    // Arrange
    const playbackLoader = loadDefaultStrudelPlayback

    // Act
    await playbackLoader(buildPlaybackHooks())

    // Assert
    expect(mockAudioInitializer).toHaveBeenCalledTimes(1)
    expect(mockSynthRegistrar).toHaveBeenCalledTimes(1)
    expect(mockResumeFunction).toHaveBeenCalledTimes(1)
  })

  it('creates and resumes the audio context in the tap itself, before the engine downloads', async () => {
    // Arrange: iOS only lets audio start inside the tap, which is over once the loader awaits.
    const gestureContexts: GestureAudioContext[] = []
    vi.stubGlobal('AudioContext', createAudioContextStub(gestureContexts))

    try {
      // Act
      const loading = loadDefaultStrudelPlayback(buildPlaybackHooks())
      const resumedBeforeFirstAwait = gestureContexts.map(
        (context) => context.resume.mock.calls.length
      )
      await loading

      // Assert
      expect(resumedBeforeFirstAwait).toEqual([1])
      expect(mockContextSetter).toHaveBeenCalledWith(gestureContexts[0])
      expect(mockContextSetter.mock.invocationCallOrder[0]).toBeLessThan(
        mockAudioInitializer.mock.invocationCallOrder[0] ?? 0
      )
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('keeps one audio context for the page, unlocking it again on a later load', async () => {
    // Arrange: browsers cap how many contexts can be open, so a new one per visit would go silent.
    const gestureContexts: GestureAudioContext[] = []
    vi.stubGlobal('AudioContext', createAudioContextStub(gestureContexts))

    try {
      // Act
      await loadDefaultStrudelPlayback(buildPlaybackHooks())
      await loadDefaultStrudelPlayback(buildPlaybackHooks())

      // Assert
      const [firstContext, secondContext] = mockContextSetter.mock.calls.map(([context]) => context)
      expect(secondContext).toBe(firstContext)
      expect(gestureContexts.length).toBeLessThanOrEqual(1)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('asks iOS to play through the silent switch', async () => {
    // Arrange
    const audioSession = { type: 'auto' }
    Object.defineProperty(navigator, 'audioSession', { value: audioSession, configurable: true })
    vi.stubGlobal('AudioContext', createAudioContextStub([]))

    try {
      // Act
      await loadDefaultStrudelPlayback(buildPlaybackHooks())

      // Assert
      expect(audioSession.type).toBe('playback')
    } finally {
      Reflect.deleteProperty(navigator, 'audioSession')
      vi.unstubAllGlobals()
    }
  })

  it('resumes the audio context on every evaluation, in case iOS suspended it', async () => {
    // Arrange
    const playback = await loadDefaultStrudelPlayback(buildPlaybackHooks())
    mockResumeFunction.mockClear()

    // Act
    await playback.evaluateCode('s("bd sd")')

    // Assert
    expect(mockResumeFunction).toHaveBeenCalledTimes(1)
    expect(mockResumeFunction.mock.invocationCallOrder[0]).toBeLessThan(
      mockEvaluateFunction.mock.invocationCallOrder[0] ?? 0
    )
  })

  it('reads pattern time from the audio context clock', async () => {
    // Arrange
    mockContextGetter.mockReturnValue({ currentTime: 1.5, resume: mockResumeFunction })

    // Act
    await loadDefaultStrudelPlayback(buildPlaybackHooks())
    const replOptions = mockReplFactory.mock.calls[0]?.[0] as Record<string, unknown>
    const getTime = replOptions.getTime as () => number

    // Assert
    expect(getTime()).toBe(1.5)
  })

  it('evaluates code through the repl instance', async () => {
    // Arrange
    const playback = await loadDefaultStrudelPlayback(buildPlaybackHooks())

    // Act
    const evaluationResult = await playback.evaluateCode('s("bd sd")')

    // Assert
    expect(mockEvaluateFunction).toHaveBeenCalledWith('s("bd sd")')
    expect(evaluationResult).toEqual({ success: true })
  })

  it('loads the default drum kit before anything can evaluate', async () => {
    // Arrange
    const playbackLoader = loadDefaultStrudelPlayback

    // Act
    const playback = await playbackLoader(buildPlaybackHooks())
    await playback.evaluateCode('s("bd sd")')

    // Assert
    expect(mockSampleBankLoader).toHaveBeenCalledWith(DEFAULT_SAMPLE_BANK)
    const bankLoadOrder = mockSampleBankLoader.mock.invocationCallOrder[0] ?? 0
    const evaluateOrder = mockEvaluateFunction.mock.invocationCallOrder[0] ?? 0
    expect(bankLoadOrder).toBeLessThan(evaluateOrder)
  })

  it('puts slider() and the draw functions in the evaluation scope', async () => {
    // Arrange
    const hooks = buildPlaybackHooks()

    // Act
    await loadDefaultStrudelPlayback(hooks)
    const scopeModules = mockScopeInitializer.mock.calls[0] ?? []

    // Assert
    expect(scopeModules).toContainEqual({ slider: mockSlider, sliderWithID: mockSliderWithId })
  })

  it('hands the sliders and widgets of each evaluation to the editor', async () => {
    // Arrange
    const hooks = buildPlaybackHooks()
    await loadDefaultStrudelPlayback(hooks)
    const meta = { miniLocations: [[0, 2]], widgets: [{ type: 'slider', from: 10, to: 13 }] }

    // Act
    callReplOption('afterEval', { meta, pattern: { getPainters: () => [] } })

    // Assert
    expect(hooks.onEvaluated).toHaveBeenCalledWith(meta)
    expect(mockDrawer.setDrawTime).toHaveBeenCalledWith([0, 0])
  })

  it('opens the draw window when the pattern paints a pianoroll or scope', async () => {
    // Arrange
    await loadDefaultStrudelPlayback(buildPlaybackHooks())

    // Act
    callReplOption('afterEval', { meta: {}, pattern: { getPainters: () => [vi.fn()] } })

    // Assert
    expect(mockDrawer.setDrawTime).toHaveBeenCalledWith([-2, 2])
  })

  it.each([
    [true, 'start'],
    [false, 'stop']
  ] as const)('runs the drawer while playing is %s', async (started, drawerMethod) => {
    // Arrange
    const hooks = buildPlaybackHooks()
    await loadDefaultStrudelPlayback(hooks)

    // Act
    callReplOption('onToggle', started)

    // Assert
    expect(mockDrawer[drawerMethod]).toHaveBeenCalledTimes(1)
    expect(hooks.onStopped).toHaveBeenCalledTimes(started ? 0 : 1)
  })

  it.each([
    ['before the next evaluation', 'beforeEval', undefined],
    ['when playing stops', 'onToggle', false]
  ] as const)(
    'stops and clears every visual %s while the editor canvas is there',
    async (_moment, replOption, optionArgument) => {
      // Arrange
      const hooks = {
        ...buildPlaybackHooks(),
        // jsdom has no 2D canvas; the loader only checks that the editor still has one.
        getDrawContext: vi.fn(() => ({}) as CanvasRenderingContext2D)
      }
      await loadDefaultStrudelPlayback(hooks)

      // Act
      callReplOption(replOption, optionArgument)

      // Assert
      expect(mockCleanupDraw).toHaveBeenCalledWith(true)
    }
  )

  it('leaves the visuals alone once the editor canvas is gone', async () => {
    // Arrange
    await loadDefaultStrudelPlayback(buildPlaybackHooks())

    // Act
    callReplOption('beforeEval', undefined)
    callReplOption('onToggle', false)

    // Assert
    expect(mockCleanupDraw).not.toHaveBeenCalled()
  })

  it('reports a pattern that fails to evaluate instead of claiming it plays', async () => {
    // Arrange
    const playback = await loadDefaultStrudelPlayback(buildPlaybackHooks())
    mockEvaluateFunction.mockImplementation(async () => {
      callReplOption('onEvalError', new Error('Unexpected token'))
    })

    // Act
    const evaluationResult = await playback.evaluateCode('s("bd"')

    // Assert
    expect(evaluationResult).toEqual({ success: false, errorMessage: 'Unexpected token' })
  })

  it('plays through the real loader wiring with mocked modules', async () => {
    // Arrange
    const { playPattern, editorStatus } = useStrudelEditor({
      initialExamples: buildExampleList(),
      playbackLoader: loadDefaultStrudelPlayback
    })

    // Act
    await playPattern()

    // Assert
    expect(mockAudioInitializer).toHaveBeenCalledTimes(1)
    expect(mockEvaluateFunction).toHaveBeenCalledWith('s("bd sd")')
    expect(editorStatus.value).toBe('playing')
  })
})

describe('useStrudelEditor', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it.each([
    ['the saved code', 's("hh*16")', 's("hh*16")'],
    ['the default example, with nothing saved', null, 's("bd sd")']
  ])('opens on %s', (_case, savedCode, expectedCode) => {
    // Arrange
    if (savedCode !== null) {
      localStorage.setItem(STRUDEL_SAVED_CODE_STORAGE_KEY, savedCode)
    }

    // Act
    const { patternCode } = useStrudelEditor({ initialExamples: buildExampleList() })

    // Assert
    expect(patternCode.value).toBe(expectedCode)
  })

  it('saves the code under a name, lists it and keeps it for the next visit', () => {
    // Arrange
    const firstVisit = useStrudelEditor({ initialExamples: buildExampleList() })
    firstVisit.updatePatternCode('s("cp*3")')

    // Act
    firstVisit.savePattern('My beat')
    const nextVisit = useStrudelEditor({ initialExamples: buildExampleList() })

    // Assert
    expect(firstVisit.savedPatterns.value).toEqual([
      { id: 'saved-my-beat', label: 'My beat', code: 's("cp*3")' }
    ])
    expect(nextVisit.savedPatterns.value).toEqual(firstVisit.savedPatterns.value)
    expect(localStorage.getItem(STRUDEL_SAVED_PATTERNS_STORAGE_KEY)).toBe(
      '[{"name":"My beat","code":"s(\\"cp*3\\")"}]'
    )
  })

  it('replaces a save under the same name and deletes one by its anchor', () => {
    // Arrange
    const { savePattern, deleteSavedPattern, updatePatternCode, savedPatterns } = useStrudelEditor({
      initialExamples: buildExampleList()
    })
    savePattern('Keep')
    savePattern('My beat')
    updatePatternCode('s("hh*8")')
    savePattern('my beat')

    // Act
    deleteSavedPattern('saved-keep')

    // Assert
    expect(savedPatterns.value).toEqual([
      { id: 'saved-my-beat', label: 'my beat', code: 's("hh*8")' }
    ])
  })

  it('loads a save by its anchor, as it does an example or a tune', () => {
    // Arrange
    localStorage.setItem(
      STRUDEL_SAVED_PATTERNS_STORAGE_KEY,
      JSON.stringify([{ name: 'Night drive', code: 'note("c2 g2")' }])
    )
    const { selectPattern, patternCode } = useStrudelEditor({
      initialExamples: buildExampleList()
    })

    // Act
    const found = selectPattern('saved-night-drive')

    // Assert
    expect(found).toBe(true)
    expect(patternCode.value).toBe('note("c2 g2")')
  })

  it.each([
    ['typed code', 'updatePatternCode', 's("cp*3")', 's("cp*3")'],
    ['a picked example', 'selectExample', 'four-floor', 's("bd*4")']
  ] as const)('saves %s to local storage', async (_case, action, argument, expectedSaved) => {
    // Arrange
    const editor = useStrudelEditor({ initialExamples: buildExampleList() })

    // Act
    editor[action](argument)
    await nextTick()

    // Assert
    expect(localStorage.getItem(STRUDEL_SAVED_CODE_STORAGE_KEY)).toBe(expectedSaved)
  })

  it('starts on the default example code', () => {
    // Arrange
    const exampleList = buildExampleList()

    // Act
    const { selectedExampleId, patternCode, editorStatus } = useStrudelEditor({
      initialExamples: exampleList,
      initialExampleId: 'four-floor',
      playbackLoader: async () => buildSuccessfulPlayback()
    })

    // Assert
    expect(selectedExampleId.value).toBe('four-floor')
    expect(patternCode.value).toBe('s("bd*4")')
    expect(editorStatus.value).toBe('idle')
  })

  it('loads the selected example code and clears the previous status', async () => {
    // Arrange
    const { selectExample, selectedExampleId, patternCode, playPattern, editorStatus } =
      useStrudelEditor({
        initialExamples: buildExampleList(),
        playbackLoader: async () => buildSuccessfulPlayback()
      })
    await playPattern()

    // Act
    selectExample('four-floor')

    // Assert
    expect(selectedExampleId.value).toBe('four-floor')
    expect(patternCode.value).toBe('s("bd*4")')
    expect(editorStatus.value).toBe('idle')
  })

  it('keeps the current code when the example id is unknown', () => {
    // Arrange
    const { selectExample, patternCode } = useStrudelEditor({
      initialExamples: buildExampleList(),
      playbackLoader: async () => buildSuccessfulPlayback()
    })
    const codeBeforeSelection = patternCode.value

    // Act
    selectExample('missing-pattern')

    // Assert
    expect(patternCode.value).toBe(codeBeforeSelection)
  })

  it('updates the code as the player types', () => {
    // Arrange
    const { updatePatternCode, patternCode } = useStrudelEditor({
      initialExamples: buildExampleList(),
      playbackLoader: async () => buildSuccessfulPlayback()
    })

    // Act
    updatePatternCode('s("hh*8")')

    // Assert
    expect(patternCode.value).toBe('s("hh*8")')
  })

  it('marks playing after the pattern evaluates', async () => {
    // Arrange
    const playback = buildSuccessfulPlayback()
    const { playPattern, editorStatus } = useStrudelEditor({
      initialExamples: buildExampleList(),
      playbackLoader: async () => playback
    })

    // Act
    await playPattern()

    // Assert
    expect(playback.evaluateCode).toHaveBeenCalledWith('s("bd sd")')
    expect(editorStatus.value).toBe('playing')
  })

  it('reuses one playback instance across repeated plays', async () => {
    // Arrange
    let loaderCalls = 0
    const playback = buildSuccessfulPlayback()
    const { playPattern } = useStrudelEditor({
      initialExamples: buildExampleList(),
      playbackLoader: async () => {
        loaderCalls += 1
        return playback
      }
    })

    // Act
    await playPattern()
    await playPattern()

    // Assert
    expect(loaderCalls).toBe(1)
    expect(playback.evaluateCode).toHaveBeenCalledTimes(2)
  })

  it.each([
    ['nothing has played yet', [], false],
    ['the code playing is the code shown', ['play'], false],
    ['the code was edited after it started', ['play', 'edit'], true],
    ['the edit was run with Update', ['play', 'edit', 'play'], false],
    ['the edit was undone', ['play', 'edit', 'undo'], false],
    ['playing has stopped', ['play', 'edit', 'stop'], false]
  ] as const)(
    'reports unplayed changes as %s: %s',
    async (_case, steps, expectedUnplayedChanges) => {
      // Arrange
      const { playPattern, stopPattern, updatePatternCode, hasUnplayedChanges } = useStrudelEditor({
        initialExamples: buildExampleList(),
        playbackLoader: async () => buildSuccessfulPlayback()
      })
      const runStep = async (step: (typeof steps)[number]): Promise<void> => {
        if (step === 'play') {
          await playPattern()
        } else if (step === 'stop') {
          await stopPattern()
        } else {
          updatePatternCode(step === 'edit' ? 's("hh*8")' : 's("bd sd")')
        }
      }

      // Act
      await steps.reduce<Promise<void>>(
        (previousStep, step) => previousStep.then(() => runStep(step)),
        Promise.resolve()
      )

      // Assert
      expect(hasUnplayedChanges.value).toBe(expectedUnplayedChanges)
    }
  )

  it.each([
    ['an example', 'selectExample', 'four-floor'],
    ['an electro tune', 'selectElectroTune', ELECTRO_TUNES[0].id],
    ['a pattern by its anchor', 'selectPattern', 'four-floor']
  ] as const)('stops the music when %s is loaded over it', async (_kind, loader, patternId) => {
    // Arrange
    const playback = buildSuccessfulPlayback()
    const editor = useStrudelEditor({
      initialExamples: buildExampleList(),
      playbackLoader: async () => playback
    })
    await editor.playPattern()

    // Act
    editor[loader](patternId)

    // Assert
    await vi.waitFor(() => {
      expect(playback.stopPlayback).toHaveBeenCalledTimes(1)
    })
    expect(editor.editorStatus.value).toBe('idle')
  })

  it('loads a pattern without stopping anything when nothing plays', async () => {
    // Arrange
    const playback = buildSuccessfulPlayback()
    const { selectExample } = useStrudelEditor({
      initialExamples: buildExampleList(),
      playbackLoader: async () => playback
    })

    // Act
    selectExample('four-floor')

    // Assert
    expect(playback.stopPlayback).not.toHaveBeenCalled()
  })

  it('stops the old pattern when edited code fails, rather than leave it playing', async () => {
    // Arrange
    const playback = buildSuccessfulPlayback()
    const { playPattern, updatePatternCode, editorStatus } = useStrudelEditor({
      initialExamples: buildExampleList(),
      playbackLoader: async () => playback
    })
    await playPattern()
    vi.mocked(playback.evaluateCode).mockResolvedValueOnce({
      success: false,
      errorMessage: 'bad pattern'
    })
    updatePatternCode('s("bd sd"')

    // Act
    await playPattern()

    // Assert
    expect(playback.stopPlayback).toHaveBeenCalledTimes(1)
    expect(editorStatus.value).toBe('error')
  })

  it('reports evaluation failures instead of playing', async () => {
    // Arrange
    const failingPlayback: StrudelPlayback = {
      evaluateCode: vi.fn(async () => ({ success: false, errorMessage: 'bad pattern' })),
      stopPlayback: vi.fn(async () => {}),
      renderToWav: vi.fn(async () => ({ success: true }))
    }
    const { playPattern, editorStatus, errorMessage } = useStrudelEditor({
      initialExamples: buildExampleList(),
      playbackLoader: async () => failingPlayback
    })

    // Act
    await playPattern()

    // Assert
    expect(editorStatus.value).toBe('error')
    expect(errorMessage.value).toBe('bad pattern')
  })

  it('reports a loader throw as an editor error', async () => {
    // Arrange
    const { playPattern, editorStatus, errorMessage } = useStrudelEditor({
      initialExamples: buildExampleList(),
      playbackLoader: async () => {
        throw new Error('audio unavailable')
      }
    })

    // Act
    await playPattern()

    // Assert
    expect(editorStatus.value).toBe('error')
    expect(errorMessage.value).toBe('audio unavailable')
  })

  it('stops playback and returns to idle', async () => {
    // Arrange
    const playback = buildSuccessfulPlayback()
    const { playPattern, stopPattern, editorStatus } = useStrudelEditor({
      initialExamples: buildExampleList(),
      playbackLoader: async () => playback
    })
    await playPattern()

    // Act
    await stopPattern()

    // Assert
    expect(playback.stopPlayback).toHaveBeenCalledTimes(1)
    expect(editorStatus.value).toBe('idle')
  })

  it('reports a stop failure as an editor error', async () => {
    // Arrange
    const stoppingPlayback: StrudelPlayback = {
      evaluateCode: vi.fn(async () => ({ success: true })),
      stopPlayback: vi.fn(async () => {
        throw new Error('stop failed')
      }),
      renderToWav: vi.fn(async () => ({ success: true }))
    }
    const { playPattern, stopPattern, editorStatus, errorMessage } = useStrudelEditor({
      initialExamples: buildExampleList(),
      playbackLoader: async () => stoppingPlayback
    })
    await playPattern()

    // Act
    await stopPattern()

    // Assert
    expect(editorStatus.value).toBe('error')
    expect(errorMessage.value).toBe('stop failed')
  })

  it('exposes the electro tune list from config', () => {
    // Arrange
    const { electroTunes } = useStrudelEditor({
      initialExamples: buildExampleList(),
      playbackLoader: async () => buildSuccessfulPlayback()
    })

    // Act
    const tuneCount = electroTunes.length

    // Assert
    expect(tuneCount).toBe(ELECTRO_TUNES.length)
    expect(electroTunes.map((tune) => tune.id)).toContain('caverave')
    expect(electroTunes.map((tune) => tune.id)).toContain('flatrave')
  })

  it('loads an electro tune into the editor when selected', () => {
    // Arrange
    const { selectElectroTune, selectedExampleId, patternCode, editorStatus } = useStrudelEditor({
      initialExamples: buildExampleList(),
      playbackLoader: async () => buildSuccessfulPlayback()
    })
    const targetTune = ELECTRO_TUNES[0]

    // Act
    selectElectroTune(targetTune.id)

    // Assert
    expect(selectedExampleId.value).toBe(targetTune.id)
    expect(patternCode.value).toBe(targetTune.code)
    expect(editorStatus.value).toBe('idle')
  })

  it('ignores unknown electro tune ids', () => {
    // Arrange
    const { selectElectroTune, patternCode } = useStrudelEditor({
      initialExamples: buildExampleList(),
      playbackLoader: async () => buildSuccessfulPlayback()
    })
    const codeBeforeSelection = patternCode.value

    // Act
    selectElectroTune('missing-tune')

    // Assert
    expect(patternCode.value).toBe(codeBeforeSelection)
  })

  it('starts on the hints tab', () => {
    // Arrange
    const { activeTab } = useStrudelEditor({
      initialExamples: buildExampleList(),
      playbackLoader: async () => buildSuccessfulPlayback()
    })

    // Act
    const tabId = activeTab.value

    // Assert
    expect(tabId).toBe('hints')
  })

  it('switches tabs and tracks the active one', () => {
    // Arrange
    const { setActiveTab, activeTab } = useStrudelEditor({
      initialExamples: buildExampleList(),
      playbackLoader: async () => buildSuccessfulPlayback()
    })

    // Act
    setActiveTab('patterns')

    // Assert
    expect(activeTab.value).toBe('patterns')
  })

  it('exposes the full tab list matching strudel.cc', () => {
    // Arrange
    const { tabList } = useStrudelEditor({
      initialExamples: buildExampleList(),
      playbackLoader: async () => buildSuccessfulPlayback()
    })

    // Act
    const tabLabels = tabList.map((tab) => tab.id)

    // Assert
    expect(tabLabels).toEqual([
      'hints',
      'welcome',
      'patterns',
      'import',
      'midi',
      'reference',
      'export',
      'console',
      'settings',
      'flow'
    ])
  })

  it('writes a log entry when a pattern starts playing', async () => {
    // Arrange
    const { playPattern, logEntries } = useStrudelEditor({
      initialExamples: buildExampleList(),
      playbackLoader: async () => buildSuccessfulPlayback()
    })

    // Act
    await playPattern()

    // Assert
    expect(logEntries.value.length).toBeGreaterThan(0)
    expect(logEntries.value.some((entry) => entry.message.includes('Playing'))).toBe(true)
  })

  it('clears log entries', async () => {
    // Arrange
    const { playPattern, clearLogEntries, logEntries } = useStrudelEditor({
      initialExamples: buildExampleList(),
      playbackLoader: async () => buildSuccessfulPlayback()
    })
    await playPattern()

    // Act
    clearLogEntries()

    // Assert
    expect(logEntries.value).toEqual([])
  })
})

describe('STRUDEL_TABS', () => {
  it('puts hints first, then the strudel.cc player menu order with import after patterns', () => {
    // Arrange
    const expectedOrder = [
      'hints',
      'welcome',
      'patterns',
      'import',
      'midi',
      'reference',
      'export',
      'console',
      'settings',
      'flow'
    ]

    // Act
    const actualOrder = STRUDEL_TABS.map((tab) => tab.id)

    // Assert
    expect(actualOrder).toEqual(expectedOrder)
  })
})

describe('ELECTRO_TUNES', () => {
  it('ships at least five famous electro tunes', () => {
    // Arrange
    const tuneCount = ELECTRO_TUNES.length

    // Act
    const hasEnough = tuneCount >= 5

    // Assert
    expect(hasEnough).toBe(true)
  })

  it.each(ELECTRO_TUNES.map((tune) => [tune.id, tune.label, tune.code]))(
    'electro tune "%s" has a label and playable code',
    (_id, label, code) => {
      // Arrange
      const labelText = label as string
      const patternCode = code as string

      // Act
      const hasLabel = labelText.length > 0
      const hasCode = patternCode.length > 0

      // Assert
      expect(hasLabel).toBe(true)
      expect(hasCode).toBe(true)
    }
  )

  it('keeps every electro tune id unique', () => {
    // Arrange
    const tuneIds = ELECTRO_TUNES.map((tune) => tune.id)

    // Act
    const uniqueIds = new Set(tuneIds)

    // Assert
    expect(uniqueIds.size).toBe(tuneIds.length)
  })
})

describe('useStrudelEditor editor attachment', () => {
  const buildEditorHandle = (): StrudelEditorHandle => ({
    applyEvaluation: vi.fn(),
    highlight: vi.fn(),
    clearHighlights: vi.fn(),
    getDrawContext: vi.fn(() => null),
    clearVisuals: vi.fn()
  })

  it('routes evaluations, frames and stops to the attached editor', async () => {
    // Arrange
    const editorHandle = buildEditorHandle()
    const capturedHooks: StrudelPlaybackHooks[] = []
    const { playPattern, attachEditor } = useStrudelEditor({
      initialExamples: buildExampleList(),
      playbackLoader: async (hooks) => {
        capturedHooks.push(hooks)
        return buildSuccessfulPlayback()
      }
    })
    attachEditor(editorHandle)
    await playPattern()
    const meta = { miniLocations: [], widgets: [] }

    // Act
    capturedHooks[0]?.onEvaluated(meta)
    capturedHooks[0]?.onFrame(['hap'], 1.25)
    capturedHooks[0]?.onStopped()

    // Assert
    expect(editorHandle.applyEvaluation).toHaveBeenCalledWith(meta)
    expect(editorHandle.highlight).toHaveBeenCalledWith(['hap'], 1.25)
    expect(editorHandle.clearHighlights).toHaveBeenCalledTimes(1)
    expect(editorHandle.clearVisuals).toHaveBeenCalledTimes(1)
  })

  it('stops reaching an editor once it is detached', async () => {
    // Arrange
    const editorHandle = buildEditorHandle()
    const capturedHooks: StrudelPlaybackHooks[] = []
    const { playPattern, attachEditor } = useStrudelEditor({
      initialExamples: buildExampleList(),
      playbackLoader: async (hooks) => {
        capturedHooks.push(hooks)
        return buildSuccessfulPlayback()
      }
    })
    attachEditor(editorHandle)
    await playPattern()

    // Act
    attachEditor(null)
    capturedHooks[0]?.onFrame(['hap'], 1)

    // Assert
    expect(editorHandle.highlight).not.toHaveBeenCalled()
    expect(capturedHooks[0]?.getDrawContext()).toBeNull()
  })
})

describe('useStrudelEditor transcription', () => {
  it('loads a transcription into the editor and leaves the error state', async () => {
    // Arrange
    const transcriptionRunner = vi.fn().mockResolvedValue({
      beatsPerMinute: 100,
      bars: [{ steps: [{ drums: ['bd'], bassNote: null }], chord: null }]
    })
    const { patternCode, editorStatus, transcribeFile, loadTranscription } = useStrudelEditor({
      transcriptionRunner
    })
    editorStatus.value = 'error'

    // Act
    await transcribeFile(new File(['audio'], 'beat.mp3'))
    loadTranscription()

    // Assert
    expect(patternCode.value).toContain('setcps(100/60/4)')
    expect(patternCode.value).toContain('s("bd")')
    expect(editorStatus.value).toBe('idle')
  })

  it.each([
    [{ success: true }, 'done', ''],
    [{ success: false, errorMessage: 'bad pattern' }, 'error', 'bad pattern']
  ] as const)('exports the code on screen and reports %o', async (renderResult, status, error) => {
    // Arrange
    const playback = { ...buildSuccessfulPlayback(), renderToWav: vi.fn(async () => renderResult) }
    const { patternCode, exportPattern, exportStatus, exportError } = useStrudelEditor({
      initialExamples: buildExampleList(),
      playbackLoader: vi.fn(async () => playback)
    })
    const exportOptions = { startCycle: 0, endCycle: 2, sampleRate: 48000, fileName: '' }

    // Act
    await exportPattern(exportOptions)

    // Assert
    expect(playback.renderToWav).toHaveBeenCalledWith(patternCode.value, exportOptions)
    expect(exportStatus.value).toBe(status)
    expect(exportError.value).toBe(error)
  })
})
