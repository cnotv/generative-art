import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import type * as THREE from 'three'

export interface PerfMetrics {
  fps: number
  ms: number
  drawCalls: number
  triangles: number
  heapMB: number
}

export const usePerfMetricsStore = defineStore('perfMetrics', () => {
  const renderer = shallowRef<THREE.WebGLRenderer | null>(null)
  const fps = ref(0)
  const ms = ref(0)
  const drawCalls = ref(0)
  const triangles = ref(0)
  const heapMB = ref(0)

  const setRenderer = (r: THREE.WebGLRenderer) => {
    renderer.value = r
  }

  const clearRenderer = () => {
    renderer.value = null
    drawCalls.value = 0
    triangles.value = 0
  }

  /**
   * Update all perf metrics for the current frame.
   * Called once per rAF tick from DebugPanel.
   * @param currentFps Frames per second calculated over the last second
   * @param currentMs Time in ms for the last frame
   */
  const tick = (currentFps: number, currentMs: number) => {
    fps.value = currentFps
    ms.value = currentMs

    if (renderer.value) {
      drawCalls.value = renderer.value.info.render.calls
      triangles.value = renderer.value.info.render.triangles
    }

    if ('memory' in performance) {
      const memoryInfo = (performance as Performance & { memory: { usedJSHeapSize: number } })
        .memory
      heapMB.value = Math.round(memoryInfo.usedJSHeapSize / 1048576)
    }
  }

  return { renderer, fps, ms, drawCalls, triangles, heapMB, setRenderer, clearRenderer, tick }
})
