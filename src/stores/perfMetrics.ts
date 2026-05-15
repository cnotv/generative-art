import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import type * as THREE from 'three'
import { activeRendererReference } from '@webgamekit/threejs'

export interface PerfMetrics {
  fps: number
  ms: number
  drawCalls: number
  triangles: number
  heapMB: number
}

export type PerfHistory = Record<keyof PerfMetrics, number[]>

/** One sample per second; max range is 1 h = 3 600 s. */
export const MAX_HISTORY_SIZE = 3_600

/** Legacy alias — keeps existing tests compiling. */
export const HISTORY_SIZE = MAX_HISTORY_SIZE

export const TIME_RANGE_OPTIONS = [
  { value: '60', label: '1m' },
  { value: '300', label: '5m' },
  { value: '900', label: '15m' },
  { value: '1800', label: '30m' },
  { value: '3600', label: '1h' }
] as const

export type TimeRangeValue = (typeof TIME_RANGE_OPTIONS)[number]['value']

const pushHistory = (history: number[], value: number): number[] => {
  const next = [...history, value]
  return next.length > MAX_HISTORY_SIZE ? next.slice(1) : next
}

export const usePerfMetricsStore = defineStore('perfMetrics', () => {
  const renderer = shallowRef<THREE.WebGLRenderer | null>(null)
  const fps = ref(0)
  const ms = ref(0)
  const drawCalls = ref(0)
  const triangles = ref(0)
  const heapMB = ref(0)

  const history = ref<PerfHistory>({
    fps: [],
    ms: [],
    drawCalls: [],
    triangles: [],
    heapMB: []
  })

  const setRenderer = (r: THREE.WebGLRenderer) => {
    renderer.value = r
  }

  const clearRenderer = () => {
    renderer.value = null
    drawCalls.value = 0
    triangles.value = 0
  }

  const resetHistory = () => {
    history.value = { fps: [], ms: [], drawCalls: [], triangles: [], heapMB: [] }
  }

  /**
   * Update live metric values for the current frame. Called every rAF tick.
   * @param currentFps Frames per second calculated over the last second
   * @param currentMs Frame duration in ms
   */
  const tick = (currentFps: number, currentMs: number) => {
    fps.value = currentFps
    ms.value = currentMs

    const activeR = renderer.value ?? activeRendererReference.current
    if (activeR) {
      drawCalls.value = activeR.info.render.calls
      triangles.value = activeR.info.render.triangles
    }

    if ('memory' in performance) {
      const memoryInfo = (performance as Performance & { memory: { usedJSHeapSize: number } })
        .memory
      heapMB.value = Math.round(memoryInfo.usedJSHeapSize / 1048576)
    }
  }

  /**
   * Append the current metric snapshot to the history buffers.
   * Should be called once per second, not per frame.
   */
  const recordSnapshot = () => {
    history.value = {
      fps: pushHistory(history.value.fps, fps.value),
      ms: pushHistory(history.value.ms, ms.value),
      drawCalls: pushHistory(history.value.drawCalls, drawCalls.value),
      triangles: pushHistory(history.value.triangles, triangles.value),
      heapMB: pushHistory(history.value.heapMB, heapMB.value)
    }
  }

  return {
    renderer,
    fps,
    ms,
    drawCalls,
    triangles,
    heapMB,
    history,
    setRenderer,
    clearRenderer,
    tick,
    recordSnapshot,
    resetHistory
  }
})
