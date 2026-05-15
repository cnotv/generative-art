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

/** Fixed number of data points rendered per chart, regardless of time range. */
export const BASE_POINTS = 60

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

export type ChartSnapshots = Record<TimeRangeValue, PerfHistory>

const RANGE_VALUES = TIME_RANGE_OPTIONS.map((o) => o.value) as TimeRangeValue[]

const emptyHistory = (): PerfHistory => ({
  fps: [],
  ms: [],
  drawCalls: [],
  triangles: [],
  heapMB: []
})

const emptyChartSnapshots = (): ChartSnapshots =>
  Object.fromEntries(RANGE_VALUES.map((v) => [v, emptyHistory()])) as ChartSnapshots

const pushHistory = (history: number[], value: number): number[] => {
  const next = [...history, value]
  return next.length > MAX_HISTORY_SIZE ? next.slice(1) : next
}

/**
 * Downsample `values` to exactly BASE_POINTS entries for the given range count.
 * A `bucketOffset` is computed once from completed buckets so every position
 * is a fixed offset from that base — values only advance when a new complete
 * bucket of `step` seconds is available, staying frozen in between.
 */
const downsample = (values: number[], count: number): number[] => {
  const fill = values.length > 0 ? values[0] : 0
  const step = Math.max(1, Math.floor(count / BASE_POINTS))
  const bucketOffset = Math.floor(values.length / step) - BASE_POINTS
  return Array.from({ length: BASE_POINTS }, (_, i) => {
    const index = (bucketOffset + i) * step
    return index >= 0 && index < values.length ? values[index] : fill
  })
}

const buildChartSnapshots = (h: PerfHistory): ChartSnapshots =>
  Object.fromEntries(
    RANGE_VALUES.map((v) => {
      const count = parseInt(v, 10)
      return [
        v,
        {
          fps: downsample(h.fps, count),
          ms: downsample(h.ms, count),
          drawCalls: downsample(h.drawCalls, count),
          triangles: downsample(h.triangles, count),
          heapMB: downsample(h.heapMB, count)
        }
      ]
    })
  ) as ChartSnapshots

export const usePerfMetricsStore = defineStore('perfMetrics', () => {
  const renderer = shallowRef<THREE.WebGLRenderer | null>(null)
  const fps = ref(0)
  const ms = ref(0)
  const drawCalls = ref(0)
  const triangles = ref(0)
  const heapMB = ref(0)

  const history = ref<PerfHistory>(emptyHistory())
  const chartSnapshots = ref<ChartSnapshots>(emptyChartSnapshots())

  const setRenderer = (r: THREE.WebGLRenderer) => {
    renderer.value = r
  }

  const clearRenderer = () => {
    renderer.value = null
    drawCalls.value = 0
    triangles.value = 0
  }

  const resetHistory = () => {
    history.value = emptyHistory()
    chartSnapshots.value = emptyChartSnapshots()
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
   * Append the current metric snapshot to history and rebuild all range charts.
   * Should be called once per second, not per frame.
   */
  const recordSnapshot = () => {
    const next: PerfHistory = {
      fps: pushHistory(history.value.fps, fps.value),
      ms: pushHistory(history.value.ms, ms.value),
      drawCalls: pushHistory(history.value.drawCalls, drawCalls.value),
      triangles: pushHistory(history.value.triangles, triangles.value),
      heapMB: pushHistory(history.value.heapMB, heapMB.value)
    }
    history.value = next
    chartSnapshots.value = buildChartSnapshots(next)
  }

  return {
    renderer,
    fps,
    ms,
    drawCalls,
    triangles,
    heapMB,
    history,
    chartSnapshots,
    setRenderer,
    clearRenderer,
    tick,
    recordSnapshot,
    resetHistory
  }
})
