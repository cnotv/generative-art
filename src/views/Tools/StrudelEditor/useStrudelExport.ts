import { ref } from 'vue'
import type {
  StrudelExportRequest,
  StrudelExportState,
  StrudelExportStatus,
  StrudelLogEntry,
  StrudelPlayback
} from './types'

type StrudelExportOptions = {
  loadPlayback: () => Promise<StrudelPlayback>
  readPatternCode: () => string
  stopPlayingPattern: () => Promise<void>
  appendLog: (message: string, level?: StrudelLogEntry['level']) => void
}

const describeExportError = (error: unknown): string =>
  error instanceof Error ? error.message : 'Pattern failed to export'

/**
 * Export state for the export tab: renders the code on screen to a WAV or MIDI download.
 * @param exportOptions - the editor's playback, code, stop action and console log
 * @returns the export status, its error and the export action
 */
export const useStrudelExport = (exportOptions: StrudelExportOptions): StrudelExportState => {
  const exportStatus = ref<StrudelExportStatus>('idle')
  const exportErrorMessage = ref('')

  const failExport = (message: string): void => {
    exportStatus.value = 'error'
    exportErrorMessage.value = message
    exportOptions.appendLog(message, 'error')
  }

  const exportPattern = async (request: StrudelExportRequest): Promise<void> => {
    exportStatus.value = 'exporting'
    exportErrorMessage.value = ''
    exportOptions.appendLog(`Exporting ${request.format.toUpperCase()}...`)
    try {
      const playback = await exportOptions.loadPlayback()
      await exportOptions.stopPlayingPattern()
      const exportResult = await playback.exportPattern(exportOptions.readPatternCode(), request)
      if (!exportResult.success) {
        failExport(exportResult.errorMessage ?? 'Pattern failed to export')
        return
      }
      exportStatus.value = 'idle'
      exportOptions.appendLog(
        `Exported ${request.fileName}.${request.format === 'midi' ? 'mid' : 'wav'}`
      )
    } catch (error) {
      failExport(describeExportError(error))
    }
  }

  return { exportStatus, exportErrorMessage, exportPattern }
}
