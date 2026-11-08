import { ref, watch } from 'vue'
import type { Ref } from 'vue'
import { debounce } from '@/utils/lodash'
import { STRUDEL_EXPORT_MEASURE_DELAY_MS, STRUDEL_MAX_SONG_CYCLES } from './config'
import type {
  StrudelEditorStatus,
  StrudelExportOptions,
  StrudelExportStatus,
  StrudelPlayback,
  StrudelTabId
} from './types'

type StrudelExportHooks = {
  loadPlayback: () => Promise<StrudelPlayback>
  patternCode: Ref<string>
  /** Rendering stops whatever was playing, so the editor's play state has to follow. */
  editorStatus: Ref<StrudelEditorStatus>
  appendLog: (message: string, level?: 'info' | 'warn' | 'error') => void
  /** The export tab's cycle count follows the code on screen only while it is showing. */
  activeTab: Ref<StrudelTabId | null>
}

/**
 * The WAV and MIDI export: renders the code on screen offline through the playback engine and reports
 * how it went.
 * @param hooks - the playback, the code and play state it works on, and the log
 * While the export tab is open and nothing plays, it measures how long the code lasts so the
 * cycle count can cover the whole song.
 * @returns the export status, its error, and the action that starts it
 */
export const useStrudelExport = (
  hooks: StrudelExportHooks
): {
  exportStatus: Ref<StrudelExportStatus>
  exportError: Ref<string>
  exportPattern: (exportOptions: StrudelExportOptions) => Promise<void>
  repetitionCycles: Ref<number | null>
  measureRepetition: () => Promise<void>
} => {
  const exportStatus = ref<StrudelExportStatus>('idle')
  const exportError = ref('')
  const repetitionCycles = ref<number | null>(null)

  const fail = (message: string): void => {
    exportStatus.value = 'error'
    exportError.value = message
    hooks.appendLog(message, 'error')
  }

  const exportPattern = async (exportOptions: StrudelExportOptions): Promise<void> => {
    exportStatus.value = 'rendering'
    exportError.value = ''
    hooks.appendLog(`Exporting cycles ${exportOptions.startCycle} to ${exportOptions.endCycle}...`)
    try {
      const playback = await hooks.loadPlayback()
      const render = exportOptions.format === 'midi' ? playback.renderToMidi : playback.renderToWav
      const result = await render(hooks.patternCode.value, exportOptions)
      hooks.editorStatus.value = 'idle'
      if (!result.success) {
        fail(result.errorMessage ?? 'Pattern failed to evaluate')
        return
      }
      exportStatus.value = 'done'
      hooks.appendLog(`Exported ${exportOptions.format === 'midi' ? 'MIDI' : 'WAV'} file`)
    } catch (error) {
      fail(error instanceof Error ? error.message : 'Export failed')
    }
  }

  const describeRepetition = (cycles: number | null): string =>
    cycles === null
      ? `No repeat within ${STRUDEL_MAX_SONG_CYCLES} cycles`
      : `One repetition: ${cycles} ${cycles === 1 ? 'cycle' : 'cycles'}`

  const measureRepetition = async (): Promise<void> => {
    exportError.value = ''
    try {
      const playback = await hooks.loadPlayback()
      repetitionCycles.value = await playback.measureRepetition(hooks.patternCode.value)
      hooks.editorStatus.value = 'idle'
      hooks.appendLog(describeRepetition(repetitionCycles.value))
    } catch (error) {
      hooks.editorStatus.value = 'idle'
      fail(error instanceof Error ? error.message : 'Pattern failed to evaluate')
    }
  }

  // Measuring evaluates the code, which would cut off whatever is playing, so it waits for quiet.
  const measureQuietly = debounce(async (): Promise<void> => {
    if (hooks.activeTab.value !== 'export' || hooks.editorStatus.value === 'playing') {
      return
    }
    try {
      const playback = await hooks.loadPlayback()
      repetitionCycles.value = await playback.measureRepetition(hooks.patternCode.value)
    } catch {
      // Code half way through an edit does not evaluate; Play reports why.
    }
  }, STRUDEL_EXPORT_MEASURE_DELAY_MS)

  watch([hooks.activeTab, hooks.patternCode, hooks.editorStatus], () => void measureQuietly())

  return { exportStatus, exportError, exportPattern, repetitionCycles, measureRepetition }
}
