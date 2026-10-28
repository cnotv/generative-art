import { computed, ref } from 'vue'
import type {
  ImportedTranscription,
  StrudelTranscriptionState,
  TabSong,
  TranscriptionProgress,
  TranscriptionRunner,
  TranscriptionStatus
} from '../types'
import { generateStrudelCode } from './generateStrudelCode'
import { generateScoreCode } from './generateScoreCode'
import {
  createTabSong,
  generateTabSongBlocks,
  generateTabSongCode,
  toTabSources
} from './generateTabCode'

type TranscriptionOptions = {
  runner: TranscriptionRunner
  applyCode: (patternCode: string) => void
  appendCode: (blocks: string) => void
  appendLog: (message: string, level?: 'info' | 'warn' | 'error') => void
}

// Tabs gather into one song; an audio, MIDI or score import stands alone and replaces the rest.
const withImported = (
  transcriptions: ImportedTranscription[],
  entry: ImportedTranscription
): ImportedTranscription[] =>
  entry.result.kind === 'tab' && transcriptions.every((earlier) => earlier.result.kind === 'tab')
    ? [...transcriptions, entry]
    : [entry]

/**
 * State for turning audio, MIDI or tab files into Strudel code: the analysis runs first, and the
 * code only reaches the editor when the user asks for it. Tabs collect into one song with a
 * block per instrument, read one file at a time in the order they were dropped.
 * @param options - the analysis runner and the editor hooks to write code and log
 * @returns reactive transcription state and its actions
 */
export const useStrudelTranscription = (
  options: TranscriptionOptions
): StrudelTranscriptionState => {
  const transcriptionStatus = ref<TranscriptionStatus>('idle')
  const transcriptionProgress = ref<TranscriptionProgress | null>(null)
  const importedTranscriptions = ref<ImportedTranscription[]>([])
  const transcriptionError = ref('')
  let nextId = 1
  let pendingReads = Promise.resolve()

  const tabSong = computed<TabSong>(() => createTabSong(toTabSources(importedTranscriptions.value)))

  const transcribedCode = computed(() => {
    const [first] = importedTranscriptions.value
    if (first === undefined) {
      return ''
    }
    if (first.result.kind === 'score') {
      return generateScoreCode(first.result, first.sourceName)
    }
    return first.result.kind === 'grid'
      ? generateStrudelCode(first.result, first.sourceName)
      : generateTabSongCode(tabSong.value)
  })

  const transcriptionWarnings = computed(() => tabSong.value.warnings)

  const sourceNames = (): string =>
    importedTranscriptions.value.map((entry) => entry.sourceName).join(', ')

  const transcribeOne = async (chosenFile: File): Promise<void> => {
    transcriptionStatus.value = 'working'
    transcriptionProgress.value = null
    transcriptionError.value = ''
    options.appendLog(`Transcribing ${chosenFile.name}...`)
    try {
      const result = await options.runner(chosenFile, (progress) => {
        transcriptionProgress.value = progress
      })
      importedTranscriptions.value = withImported(importedTranscriptions.value, {
        id: nextId++,
        sourceName: chosenFile.name,
        result
      })
      transcriptionStatus.value = 'done'
      options.appendLog(
        `Transcribed ${chosenFile.name}: ${result.beatsPerMinute} BPM, ${result.bars.length} bars`
      )
      if (result.kind !== 'grid') {
        result.warnings.forEach((warning) => options.appendLog(warning, 'warn'))
      }
    } catch (error) {
      transcriptionStatus.value = 'error'
      transcriptionError.value =
        error instanceof Error ? error.message : 'The file could not be transcribed'
      options.appendLog(transcriptionError.value, 'error')
    }
  }

  const transcribeFiles = (chosenFiles: File[]): Promise<void> => {
    pendingReads = chosenFiles.reduce(
      (previousRead, chosenFile) => previousRead.then(() => transcribeOne(chosenFile)),
      pendingReads
    )
    return pendingReads
  }

  const removeTranscription = (transcriptionId: number): void => {
    importedTranscriptions.value = importedTranscriptions.value.filter(
      (entry) => entry.id !== transcriptionId
    )
    if (importedTranscriptions.value.length === 0 && transcriptionStatus.value === 'done') {
      transcriptionStatus.value = 'idle'
    }
  }

  const logWarnings = (): void => {
    transcriptionWarnings.value.forEach((warning) => options.appendLog(warning, 'warn'))
  }

  const loadTranscription = (): void => {
    if (transcribedCode.value.length === 0) {
      return
    }
    options.applyCode(transcribedCode.value)
    logWarnings()
    options.appendLog(`Loaded transcription of ${sourceNames()}`)
  }

  const addTranscription = (): void => {
    if (tabSong.value.instruments.length === 0) {
      return
    }
    options.appendCode(generateTabSongBlocks(tabSong.value))
    logWarnings()
    options.appendLog(`Added ${sourceNames()} to the editor`)
  }

  return {
    transcriptionStatus,
    transcriptionProgress,
    importedTranscriptions,
    transcribedCode,
    transcriptionWarnings,
    transcriptionError,
    transcribeFiles,
    removeTranscription,
    loadTranscription,
    addTranscription
  }
}
