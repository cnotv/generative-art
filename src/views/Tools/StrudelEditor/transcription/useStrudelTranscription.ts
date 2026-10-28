import { computed, ref } from 'vue'
import type {
  ImportedTranscription,
  StrudelTranscriptionState,
  ImportedSong,
  TranscriptionProgress,
  TranscriptionRunner,
  TranscriptionStatus
} from '../types'
import {
  createImportedSong,
  generateSongBlocks,
  generateSongCode,
  toSongSources
} from './generateSongCode'
import { generateStrudelCode } from './generateStrudelCode'

type TranscriptionOptions = {
  runner: TranscriptionRunner
  applyCode: (patternCode: string) => void
  appendCode: (blocks: string) => void
  appendLog: (message: string, level?: 'info' | 'warn' | 'error') => void
}

// Tabs and scores gather into one song; an audio or MIDI import stands alone and replaces the rest.
const withImported = (
  transcriptions: ImportedTranscription[],
  entry: ImportedTranscription
): ImportedTranscription[] =>
  entry.result.kind !== 'grid' && transcriptions.every((earlier) => earlier.result.kind !== 'grid')
    ? [...transcriptions, entry]
    : [entry]

/**
 * State for turning audio, MIDI, tab or score files into Strudel code: the analysis runs first,
 * and the code only reaches the editor when the user asks for it. Tabs and scores collect into
 * one song with a block per instrument, each with a pianoroll under it unless switched off, read
 * one file at a time in the order they were dropped.
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
  const addVisualizer = ref(true)
  let nextId = 1
  let pendingReads = Promise.resolve()

  const song = computed<ImportedSong>(() =>
    createImportedSong(toSongSources(importedTranscriptions.value))
  )
  const codeOptions = computed(() => ({ addVisualizer: addVisualizer.value }))

  const transcribedCode = computed(() => {
    const [first] = importedTranscriptions.value
    if (first === undefined) {
      return ''
    }
    return first.result.kind === 'grid'
      ? generateStrudelCode(first.result, first.sourceName)
      : generateSongCode(song.value, codeOptions.value)
  })

  const transcriptionWarnings = computed(() => song.value.warnings)

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
    if (song.value.instruments.length === 0) {
      return
    }
    options.appendCode(generateSongBlocks(song.value, codeOptions.value))
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
    addVisualizer,
    transcribeFiles,
    removeTranscription,
    loadTranscription,
    addTranscription
  }
}
