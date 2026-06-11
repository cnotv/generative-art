import { defineStore } from 'pinia'
import { ref, shallowRef, computed } from 'vue'
import type { Timeline } from '@webgamekit/animation'

export interface TimelinePanelSource {
  getTimeline: () => Timeline[]
  getCurrentFrame: () => number
  getFrameRate: () => number
}

export const DEFAULT_WINDOW_SECONDS = 10

export const useTimelinePanelStore = defineStore('timelinePanel', () => {
  const windowSeconds = ref(DEFAULT_WINDOW_SECONDS)
  const source = shallowRef<TimelinePanelSource | null>(null)

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

  const resetState = (): void => {
    windowSeconds.value = DEFAULT_WINDOW_SECONDS
    source.value = null
  }

  return {
    windowSeconds,
    source,
    isAvailable,
    register,
    unregister,
    setWindowSeconds,
    resetState
  }
})
