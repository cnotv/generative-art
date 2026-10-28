import { describe, it, expect, vi } from 'vitest'
import type { TranscriptionResult, TranscriptionRunner } from '../types'
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

const createFile = (name = 'song.mp3'): File => new File(['audio'], name, { type: 'audio/mpeg' })

const setup = (runner: TranscriptionRunner) => {
  const applyCode = vi.fn()
  const appendLog = vi.fn()
  const transcription = useStrudelTranscription({ runner, applyCode, appendLog })
  return { transcription, applyCode, appendLog }
}

describe('useStrudelTranscription', () => {
  it('turns the analysed file into Strudel code without touching the editor yet', async () => {
    // Arrange
    const { transcription, applyCode } = setup(vi.fn().mockResolvedValue(RESULT))

    // Act
    await transcription.transcribeFile(createFile())

    // Assert
    expect(transcription.transcriptionStatus.value).toBe('done')
    expect(transcription.transcriptionResult.value).toEqual(RESULT)
    expect(transcription.transcribedCode.value).toContain('setcps(128/60/4)')
    expect(transcription.transcribedCode.value).toContain('chord("Am")')
    expect(applyCode).not.toHaveBeenCalled()
  })

  it('writes the code into the editor and logs it when loaded', async () => {
    // Arrange
    const { transcription, applyCode, appendLog } = setup(vi.fn().mockResolvedValue(RESULT))
    await transcription.transcribeFile(createFile('loop.wav'))

    // Act
    transcription.loadTranscription()

    // Assert
    expect(applyCode).toHaveBeenCalledWith(transcription.transcribedCode.value)
    expect(appendLog).toHaveBeenCalledWith('Transcribed loop.wav: 128 BPM, 1 bars')
    expect(appendLog).toHaveBeenCalledWith('Loaded transcription of loop.wav')
  })

  it('does nothing on load before any transcription', () => {
    // Arrange
    const { transcription, applyCode } = setup(vi.fn())

    // Act
    transcription.loadTranscription()

    // Assert
    expect(applyCode).not.toHaveBeenCalled()
  })

  it('forwards progress while the analysis runs', async () => {
    // Arrange
    const runner: TranscriptionRunner = async (_file, onProgress) => {
      onProgress({ stage: 'tempo', fraction: 0.5 })
      return RESULT
    }
    const { transcription } = setup(runner)

    // Act
    await transcription.transcribeFile(createFile())

    // Assert
    expect(transcription.transcriptionProgress.value).toEqual({ stage: 'tempo', fraction: 0.5 })
  })

  it('reports a decoding failure', async () => {
    // Arrange
    const { transcription, appendLog } = setup(
      vi.fn().mockRejectedValue(new Error('Unable to decode audio data'))
    )

    // Act
    await transcription.transcribeFile(createFile('broken.mp3'))

    // Assert
    expect(transcription.transcriptionStatus.value).toBe('error')
    expect(transcription.transcriptionError.value).toBe('Unable to decode audio data')
    expect(appendLog).toHaveBeenCalledWith('Unable to decode audio data', 'error')
  })

  it('keeps only the latest file when a second one is dropped mid-analysis', async () => {
    // Arrange
    const slowResult = { ...RESULT, beatsPerMinute: 90 }
    const pendingResolvers: ((result: TranscriptionResult) => void)[] = []
    const runner: TranscriptionRunner = () =>
      new Promise((resolve) => {
        pendingResolvers.push(resolve)
      })
    const { transcription } = setup(runner)
    const firstRun = transcription.transcribeFile(createFile('first.mp3'))
    const secondRun = transcription.transcribeFile(createFile('second.mp3'))

    // Act
    pendingResolvers[1](RESULT)
    await secondRun
    pendingResolvers[0](slowResult)
    await firstRun

    // Assert
    expect(transcription.transcriptionResult.value?.beatsPerMinute).toBe(128)
    expect(transcription.transcribedCode.value).toContain('second.mp3')
  })
})
