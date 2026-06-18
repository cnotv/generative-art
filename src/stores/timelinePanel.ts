import { defineStore } from 'pinia'
import { ref, shallowRef, computed } from 'vue'
import type { Timeline } from '@webgamekit/animation'

export interface TimelinePanelSource {
  getTimeline: () => Timeline[]
  getCurrentFrame: () => number
  getFrameRate: () => number
  setActionEnabled: (id: string, enabled: boolean) => void
}

export const DEFAULT_WINDOW_SECONDS = 10

export const useTimelinePanelStore = defineStore('timelinePanel', () => {
  const windowSeconds = ref(DEFAULT_WINDOW_SECONDS)
  const source = shallowRef<TimelinePanelSource | null>(null)
  const isPaused = ref(false)

  const isAvailable = computed(() => source.value !== null)

  const register = (newSource: TimelinePanelSource): void => {
    source.value = newSource
  }

  const unregister = (): void => {
    source.value = null
  }

  const setWindowSeconds = (seconds: number): void => {
    windowSeconds.value = Math.max(1, seconds)
  }

  const setPaused = (paused: boolean): void => {
    isPaused.value = paused
  }

  const resetState = (): void => {
    windowSeconds.value = DEFAULT_WINDOW_SECONDS
    source.value = null
    isPaused.value = false
  }

  return {
    windowSeconds,
    source,
    isPaused,
    isAvailable,
    register,
    unregister,
    setWindowSeconds,
    setPaused,
    resetState
  }
})
