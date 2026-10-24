import { ref } from 'vue'
import type {
  StrudelTranscriptionState,
  TranscriptionProgress,
  TranscriptionResult,
  TranscriptionRunner,
  TranscriptionStatus
} from '../types'
import { generateStrudelCode } from './generateStrudelCode'

type TranscriptionOptions = {
  runner: TranscriptionRunner
  applyCode: (patternCode: string) => void
  appendLog: (message: string, level?: 'info' | 'warn' | 'error') => void
}

/**
 * State for turning an audio file into Strudel code: the analysis runs first, and the
 * code only replaces the editor's when the user asks for it.
 * @param options - the analysis runner and the editor hooks to write code and log
 * @returns reactive transcription state and its actions
 */
export const useStrudelTranscription = (
  options: TranscriptionOptions
): StrudelTranscriptionState => {
  const transcriptionStatus = ref<TranscriptionStatus>('idle')
  const transcriptionProgress = ref<TranscriptionProgress | null>(null)
  const transcriptionResult = ref<TranscriptionResult | null>(null)
  const transcribedCode = ref('')
  const transcriptionError = ref('')
  const sourceName = ref('')
  let latestRequest = 0

  const transcribeAudioFile = async (audioFile: File): Promise<void> => {
    latestRequest += 1
    const requestNumber = latestRequest
    const isCurrent = (): boolean => requestNumber === latestRequest
    transcriptionStatus.value = 'working'
    transcriptionProgress.value = null
    transcriptionError.value = ''
    options.appendLog(`Transcribing ${audioFile.name}...`)
    try {
      const result = await options.runner(audioFile, (progress) => {
        if (isCurrent()) {
          transcriptionProgress.value = progress
        }
      })
      if (!isCurrent()) {
        return
      }
      transcriptionResult.value = result
      transcribedCode.value = generateStrudelCode(result, audioFile.name)
      sourceName.value = audioFile.name
      transcriptionStatus.value = 'done'
      options.appendLog(
        `Transcribed ${audioFile.name}: ${result.beatsPerMinute} BPM, ${result.bars.length} bars`
      )
    } catch (error) {
      if (!isCurrent()) {
        return
      }
      transcriptionStatus.value = 'error'
      transcriptionError.value =
        error instanceof Error ? error.message : 'The file could not be transcribed'
      options.appendLog(transcriptionError.value, 'error')
    }
  }

  const loadTranscription = (): void => {
    if (transcribedCode.value.length === 0) {
      return
    }
    options.applyCode(transcribedCode.value)
    options.appendLog(`Loaded transcription of ${sourceName.value}`)
  }

  return {
    transcriptionStatus,
    transcriptionProgress,
    transcriptionResult,
    transcribedCode,
    transcriptionError,
    transcribeAudioFile,
    loadTranscription
  }
}
