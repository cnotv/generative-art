import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DEFAULT_SAMPLE_BANK, DEFAULT_STRUDEL_EXAMPLE_ID, STRUDEL_EXAMPLES } from './config'
import type { StrudelExample, StrudelPlayback } from './types'
import {
  findStrudelExample,
  listStrudelExampleOptions,
  loadDefaultStrudelPlayback,
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
  mockResumeFunction,
  mockScheduleHandler,
  mockCodeTranspiler,
  mockEvaluateFunction,
  mockStopFunction
} = vi.hoisted(() => ({
  mockReplFactory: vi.fn(),
  mockScopeInitializer: vi.fn(),
  mockAudioInitializer: vi.fn(),
  mockSynthRegistrar: vi.fn(),
  mockSampleBankLoader: vi.fn(),
  mockContextGetter: vi.fn(),
  mockResumeFunction: vi.fn(),
  mockScheduleHandler: vi.fn(),
  mockCodeTranspiler: vi.fn(),
  mockEvaluateFunction: vi.fn(),
  mockStopFunction: vi.fn()
}))

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
  webaudioOutput: mockScheduleHandler
}))
vi.mock('@strudel/tonal', () => ({}))
vi.mock('@strudel/transpiler', () => ({
  transpiler: mockCodeTranspiler
}))

const buildExampleList = (): StrudelExample[] => [
  { id: 'first-beat', label: 'First beat', code: 's("bd sd")' },
  { id: 'four-floor', label: 'Four floor', code: 's("bd*4")' }
]

const buildSuccessfulPlayback = (): StrudelPlayback => ({
  evaluateCode: vi.fn(async () => ({ success: true })),
  stopPlayback: vi.fn(async () => {})
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

describe('listStrudelExampleOptions', () => {
  it('maps every example to a select option', () => {
    // Arrange
    const exampleList = buildExampleList()

    // Act
    const exampleOptions = listStrudelExampleOptions(exampleList)

    // Assert
    expect(exampleOptions).toEqual([
      { value: 'first-beat', label: 'First beat' },
      { value: 'four-floor', label: 'Four floor' }
    ])
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
    mockContextGetter.mockResolvedValue({ currentTime: 0, resume: mockResumeFunction })
    mockReplFactory.mockResolvedValue({
      evaluate: mockEvaluateFunction,
      stop: mockStopFunction
    })
  })

  it('hands the scheduler output to the pinned core under defaultOutput', async () => {
    // Arrange
    const playbackLoader = loadDefaultStrudelPlayback

    // Act
    await playbackLoader()
    const replOptions = mockReplFactory.mock.calls[0]?.[0] as Record<string, unknown>

    // Assert
    expect(replOptions.defaultOutput).toBe(mockScheduleHandler)
    expect(replOptions).not.toHaveProperty('onSchedule')
  })

  it('initializes and resumes audio inside the play gesture', async () => {
    // Arrange
    const playbackLoader = loadDefaultStrudelPlayback

    // Act
    await playbackLoader()

    // Assert
    expect(mockAudioInitializer).toHaveBeenCalledTimes(1)
    expect(mockSynthRegistrar).toHaveBeenCalledTimes(1)
    expect(mockResumeFunction).toHaveBeenCalledTimes(1)
  })

  it('reads pattern time from the audio context clock', async () => {
    // Arrange
    mockContextGetter.mockResolvedValue({ currentTime: 1.5, resume: mockResumeFunction })

    // Act
    await loadDefaultStrudelPlayback()
    const replOptions = mockReplFactory.mock.calls[0]?.[0] as Record<string, unknown>
    const getTime = replOptions.getTime as () => number

    // Assert
    expect(getTime()).toBe(1.5)
  })

  it('evaluates code through the repl instance', async () => {
    // Arrange
    const playback = await loadDefaultStrudelPlayback()

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
    const playback = await playbackLoader()
    await playback.evaluateCode('s("bd sd")')

    // Assert
    expect(mockSampleBankLoader).toHaveBeenCalledWith(DEFAULT_SAMPLE_BANK)
    const bankLoadOrder = mockSampleBankLoader.mock.invocationCallOrder[0] ?? 0
    const evaluateOrder = mockEvaluateFunction.mock.invocationCallOrder[0] ?? 0
    expect(bankLoadOrder).toBeLessThan(evaluateOrder)
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

  it('reports evaluation failures instead of playing', async () => {
    // Arrange
    const failingPlayback: StrudelPlayback = {
      evaluateCode: vi.fn(async () => ({ success: false, errorMessage: 'bad pattern' })),
      stopPlayback: vi.fn(async () => {})
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
      })
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
})
