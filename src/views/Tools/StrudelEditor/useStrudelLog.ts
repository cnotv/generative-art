import { ref } from 'vue'
import type { Ref } from 'vue'
import type { StrudelLogEntry } from './types'

type StrudelLog = {
  logEntries: Ref<StrudelLogEntry[]>
  appendLog: (message: string, level?: StrudelLogEntry['level']) => void
  clearLogEntries: () => void
}

/**
 * The console tab's log: what was played, stopped, loaded and what failed.
 * @returns the entries and the actions that add to and clear them
 */
export const useStrudelLog = (): StrudelLog => {
  const logEntries = ref<StrudelLogEntry[]>([])
  let logCounter = 0
  return {
    logEntries,
    appendLog: (message, level = 'info') => {
      logCounter += 1
      logEntries.value = [...logEntries.value, { id: logCounter, message, level }]
    },
    clearLogEntries: () => {
      logEntries.value = []
    }
  }
}
