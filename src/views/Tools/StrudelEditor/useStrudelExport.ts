import { ref } from 'vue'
import type { Ref } from 'vue'
import type {
  StrudelEditorStatus,
  StrudelExportOptions,
  StrudelExportStatus,
  StrudelPlayback
} from './types'

type StrudelExportHooks = {
  loadPlayback: () => Promise<StrudelPlayback>
  patternCode: Ref<string>
  /** Rendering stops whatever was playing, so the editor's play state has to follow. */
  editorStatus: Ref<StrudelEditorStatus>
  appendLog: (message: string, level?: 'info' | 'warn' | 'error') => void
}

/**
 * The WAV export: renders the code on screen offline through the playback engine and reports
 * how it went.
 * @param hooks - the playback, the code and play state it works on, and the log
 * @returns the export status, its error, and the action that starts it
 */
export const useStrudelExport = (
  hooks: StrudelExportHooks
): {
  exportStatus: Ref<StrudelExportStatus>
  exportError: Ref<string>
  exportPattern: (exportOptions: StrudelExportOptions) => Promise<void>
} => {
  const exportStatus = ref<StrudelExportStatus>('idle')
  const exportError = ref('')

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
      const result = await playback.renderToWav(hooks.patternCode.value, exportOptions)
      hooks.editorStatus.value = 'idle'
      if (!result.success) {
        fail(result.errorMessage ?? 'Pattern failed to evaluate')
        return
      }
      exportStatus.value = 'done'
      hooks.appendLog('Exported WAV file')
    } catch (error) {
      fail(error instanceof Error ? error.message : 'Export failed')
    }
  }

  return { exportStatus, exportError, exportPattern }
}
