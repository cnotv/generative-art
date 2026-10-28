import { describe, it, expect, vi } from 'vitest'
import type {
  ScoreTranscription,
  TabTranscription,
  TranscriptionOutput,
  TranscriptionResult,
  TranscriptionRunner
} from '../types'
import { useStrudelTranscription } from './useStrudelTranscription'

const RESULT: TranscriptionResult = {
  kind: 'grid',
  beatsPerMinute: 128,
  bars: [
    {
      steps: Array.from({ length: 16 }, (_, stepIndex) => ({
        drums: stepIndex % 4 === 0 ? ['bd'] : [],
        bassNote: null
      })),
      chord: 'Am'
    }
  ]
}

const BASS_TAB: TabTranscription = {
  kind: 'tab',
  beatsPerMinute: 96,
  instrument: 'bass',
  bars: [[{ notes: ['a2'], beats: 4 }]],
  warnings: []
}

const GUITAR_TAB: TabTranscription = {
  ...BASS_TAB,
  instrument: 'guitar',
  bars: [[{ notes: ['e4'], beats: 4 }]]
}

const createFile = (name = 'song.mp3'): File => new File(['audio'], name, { type: 'audio/mpeg' })

const setup = (runner: TranscriptionRunner) => {
  const applyCode = vi.fn()
  const appendCode = vi.fn()
  const appendLog = vi.fn()
  const transcription = useStrudelTranscription({ runner, applyCode, appendCode, appendLog })
  return { transcription, applyCode, appendCode, appendLog }
}

const SCORE: ScoreTranscription = {
  kind: 'score',
  beatsPerMinute: 65,
  beatsPerBar: 4,
  bars: [{ rightHand: [{ notes: ['a5'], beats: 4 }], leftHand: [{ notes: ['f#3'], beats: 4 }] }],
  warnings: ['Bar 7, right hand: holds 3.75 beats, not 4']
}

// Answers each file with the result listed under its name.
const runnerByName =
  (results: Record<string, TranscriptionOutput>): TranscriptionRunner =>
  async (chosenFile) =>
    results[chosenFile.name]

describe('useStrudelTranscription', () => {
  it('writes a piano score as two hands and logs what it could not read', async () => {
    // Arrange
    const { transcription, appendLog } = setup(vi.fn().mockResolvedValue(SCORE))

    // Act
    await transcription.transcribeFiles([createFile('river.png')])

    // Assert
    expect(transcription.transcribedCode.value).toContain('// right hand')
    expect(transcription.transcribedCode.value).toContain('// left hand')
    expect(appendLog).toHaveBeenCalledWith('Bar 7, right hand: holds 3.75 beats, not 4', 'warn')
  })

  it('turns the analysed file into Strudel code without touching the editor yet', async () => {
    // Arrange
    const { transcription, applyCode } = setup(vi.fn().mockResolvedValue(RESULT))

    // Act
    await transcription.transcribeFiles([createFile()])

    // Assert
    expect(transcription.transcriptionStatus.value).toBe('done')
    expect(transcription.importedTranscriptions.value.map((entry) => entry.result)).toEqual([
      RESULT
    ])
    expect(transcription.transcribedCode.value).toContain('setcps(128/60/4)')
    expect(transcription.transcribedCode.value).toContain('chord("Am")')
    expect(applyCode).not.toHaveBeenCalled()
  })

  it('writes the code into the editor and logs it when loaded', async () => {
    // Arrange
    const { transcription, applyCode, appendLog } = setup(vi.fn().mockResolvedValue(RESULT))
    await transcription.transcribeFiles([createFile('loop.wav')])

    // Act
    transcription.loadTranscription()

    // Assert
    expect(applyCode).toHaveBeenCalledWith(transcription.transcribedCode.value)
    expect(appendLog).toHaveBeenCalledWith('Transcribed loop.wav: 128 BPM, 1 bars')
    expect(appendLog).toHaveBeenCalledWith('Loaded transcription of loop.wav')
  })

  it.each(['loadTranscription', 'addTranscription'] as const)(
    'does nothing on %s before any transcription',
    (action) => {
      // Arrange
      const { transcription, applyCode, appendCode } = setup(vi.fn())

      // Act
      transcription[action]()

      // Assert
      expect(applyCode).not.toHaveBeenCalled()
      expect(appendCode).not.toHaveBeenCalled()
    }
  )

  it('forwards progress while the analysis runs', async () => {
    // Arrange
    const runner: TranscriptionRunner = async (_file, onProgress) => {
      onProgress({ stage: 'tempo', fraction: 0.5 })
      return RESULT
    }
    const { transcription } = setup(runner)

    // Act
    await transcription.transcribeFiles([createFile()])

    // Assert
    expect(transcription.transcriptionProgress.value).toEqual({ stage: 'tempo', fraction: 0.5 })
  })

  it('reports a decoding failure', async () => {
    // Arrange
    const { transcription, appendLog } = setup(
      vi.fn().mockRejectedValue(new Error('Unable to decode audio data'))
    )

    // Act
    await transcription.transcribeFiles([createFile('broken.mp3')])

    // Assert
    expect(transcription.transcriptionStatus.value).toBe('error')
    expect(transcription.transcriptionError.value).toBe('Unable to decode audio data')
    expect(appendLog).toHaveBeenCalledWith('Unable to decode audio data', 'error')
  })

  it('reads a file dropped mid-analysis after the first, so the latest audio wins', async () => {
    // Arrange
    const slowResult = { ...RESULT, beatsPerMinute: 90 }
    const pendingResolvers: ((result: TranscriptionResult) => void)[] = []
    const runner: TranscriptionRunner = () =>
      new Promise((resolve) => {
        pendingResolvers.push(resolve)
      })
    const { transcription } = setup(runner)
    const firstRun = transcription.transcribeFiles([createFile('first.mp3')])
    const secondRun = transcription.transcribeFiles([createFile('second.mp3')])

    // Act
    await vi.waitFor(() => expect(pendingResolvers).toHaveLength(1))
    pendingResolvers[0](slowResult)
    await firstRun
    await vi.waitFor(() => expect(pendingResolvers).toHaveLength(2))
    pendingResolvers[1](RESULT)
    await secondRun

    // Assert
    expect(transcription.importedTranscriptions.value).toHaveLength(1)
    expect(transcription.importedTranscriptions.value[0].result.beatsPerMinute).toBe(128)
    expect(transcription.transcribedCode.value).toContain('second.mp3')
  })

  it('collects tabs from one drop and from later drops into one song, in order', async () => {
    // Arrange
    const { transcription } = setup(
      runnerByName({ 'low.png': BASS_TAB, 'lead.png': GUITAR_TAB, 'high.png': BASS_TAB })
    )

    // Act
    await transcription.transcribeFiles([createFile('low.png'), createFile('lead.png')])
    await transcription.transcribeFiles([createFile('high.png')])

    // Assert
    expect(transcription.importedTranscriptions.value.map((entry) => entry.sourceName)).toEqual([
      'low.png',
      'lead.png',
      'high.png'
    ])
    expect(transcription.transcribedCode.value.match(/^\$: /gm)).toHaveLength(3)
    expect(transcription.transcribedCode.value.match(/setcps/g)).toHaveLength(1)
  })

  it.each([
    ['an audio song', 'song.mp3', RESULT],
    ['a piano score', 'river.png', SCORE]
  ] as const)(
    'replaces the tabs with %s, and that with a later tab',
    async (_description, standaloneName, standaloneResult) => {
      // Arrange
      const { transcription } = setup(
        runnerByName({
          'low.png': BASS_TAB,
          [standaloneName]: standaloneResult,
          'lead.png': GUITAR_TAB
        })
      )

      // Act
      await transcription.transcribeFiles([createFile('low.png'), createFile(standaloneName)])
      const afterStandalone = transcription.importedTranscriptions.value.map(
        (entry) => entry.sourceName
      )
      await transcription.transcribeFiles([createFile('lead.png')])

      // Assert
      expect(afterStandalone).toEqual([standaloneName])
      expect(transcription.importedTranscriptions.value.map((entry) => entry.sourceName)).toEqual([
        'lead.png'
      ])
    }
  )

  it('removes one tab from the song and goes idle once none is left', async () => {
    // Arrange
    const { transcription } = setup(runnerByName({ 'low.png': BASS_TAB, 'lead.png': GUITAR_TAB }))
    await transcription.transcribeFiles([createFile('low.png'), createFile('lead.png')])
    const [bass, guitar] = transcription.importedTranscriptions.value

    // Act
    transcription.removeTranscription(bass.id)
    const codeAfterFirstRemoval = transcription.transcribedCode.value
    transcription.removeTranscription(guitar.id)

    // Assert
    expect(codeAfterFirstRemoval).toContain('gm_acoustic_guitar_nylon')
    expect(codeAfterFirstRemoval).not.toContain('gm_electric_bass_finger')
    expect(transcription.importedTranscriptions.value).toEqual([])
    expect(transcription.transcriptionStatus.value).toBe('idle')
  })

  it('adds the tabs to the editor as labelled blocks without a second tempo', async () => {
    // Arrange
    const { transcription, appendCode, applyCode, appendLog } = setup(
      runnerByName({ 'lead.png': GUITAR_TAB })
    )
    await transcription.transcribeFiles([createFile('lead.png')])

    // Act
    transcription.addTranscription()

    // Assert
    expect(applyCode).not.toHaveBeenCalled()
    expect(appendCode).toHaveBeenCalledWith(
      '// guitar "lead.png": 1 bars\n$: note("e4").s("gm_acoustic_guitar_nylon")'
    )
    expect(appendLog).toHaveBeenCalledWith('Added lead.png to the editor')
  })

  it('logs the song warnings when the tabs disagree on tempo', async () => {
    // Arrange
    const { transcription, appendLog } = setup(
      runnerByName({
        'low.png': BASS_TAB,
        'lead.png': { ...GUITAR_TAB, beatsPerMinute: 120 }
      })
    )
    await transcription.transcribeFiles([createFile('low.png'), createFile('lead.png')])

    // Act
    transcription.loadTranscription()

    // Assert
    expect(transcription.transcriptionWarnings.value).toHaveLength(1)
    expect(appendLog).toHaveBeenCalledWith(transcription.transcriptionWarnings.value[0], 'warn')
    expect(appendLog).toHaveBeenCalledWith('Loaded transcription of low.png, lead.png')
  })
})
