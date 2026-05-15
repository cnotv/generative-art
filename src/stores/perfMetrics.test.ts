import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { usePerfMetricsStore, HISTORY_SIZE } from './perfMetrics'
import type * as THREE from 'three'

const makeRenderer = (calls = 0, triangles = 0): THREE.WebGLRenderer =>
  ({
    info: { render: { calls, triangles } }
  }) as unknown as THREE.WebGLRenderer

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('usePerfMetricsStore', () => {
  describe('initial state', () => {
    it('starts with zero metrics', () => {
      const store = usePerfMetricsStore()
      expect(store.fps).toBe(0)
      expect(store.ms).toBe(0)
      expect(store.drawCalls).toBe(0)
      expect(store.triangles).toBe(0)
      expect(store.heapMB).toBe(0)
      expect(store.renderer).toBeNull()
    })
  })

  describe('setRenderer / clearRenderer', () => {
    it('stores the renderer reference', () => {
      const store = usePerfMetricsStore()
      const renderer = makeRenderer()
      store.setRenderer(renderer)
      expect(store.renderer).toBe(renderer)
    })

    it('clears renderer and resets draw-call metrics', () => {
      const store = usePerfMetricsStore()
      store.setRenderer(makeRenderer(42, 1000))
      store.tick(60, 16)
      store.clearRenderer()
      expect(store.renderer).toBeNull()
      expect(store.drawCalls).toBe(0)
      expect(store.triangles).toBe(0)
    })
  })

  describe('history', () => {
    it('starts with empty history for all metrics', () => {
      const store = usePerfMetricsStore()
      expect(store.history.fps).toHaveLength(0)
      expect(store.history.ms).toHaveLength(0)
      expect(store.history.drawCalls).toHaveLength(0)
      expect(store.history.triangles).toHaveLength(0)
      expect(store.history.heapMB).toHaveLength(0)
    })

    it('appends a value to history on each tick', () => {
      const store = usePerfMetricsStore()
      store.tick(60, 16)
      store.tick(58, 17)
      expect(store.history.fps).toEqual([60, 58])
      expect(store.history.ms).toEqual([16, 17])
    })

    it(`caps history at HISTORY_SIZE (${HISTORY_SIZE}) entries`, () => {
      const store = usePerfMetricsStore()
      Array.from({ length: HISTORY_SIZE + 10 }).forEach((_, i) => store.tick(i, i))
      expect(store.history.fps).toHaveLength(HISTORY_SIZE)
      expect(store.history.fps[0]).toBe(10)
      expect(store.history.fps[HISTORY_SIZE - 1]).toBe(HISTORY_SIZE + 9)
    })

    it('records draw calls and triangles from renderer into history', () => {
      const store = usePerfMetricsStore()
      store.setRenderer(makeRenderer(5, 1000))
      store.tick(60, 16)
      expect(store.history.drawCalls).toEqual([5])
      expect(store.history.triangles).toEqual([1000])
    })
  })

  describe('tick', () => {
    it('updates fps and ms', () => {
      const store = usePerfMetricsStore()
      store.tick(58, 17)
      expect(store.fps).toBe(58)
      expect(store.ms).toBe(17)
    })

    it('reads drawCalls and triangles from registered renderer', () => {
      const store = usePerfMetricsStore()
      store.setRenderer(makeRenderer(75, 320_000))
      store.tick(60, 16)
      expect(store.drawCalls).toBe(75)
      expect(store.triangles).toBe(320_000)
    })

    it('leaves drawCalls and triangles at zero when no renderer is set', () => {
      const store = usePerfMetricsStore()
      store.tick(60, 16)
      expect(store.drawCalls).toBe(0)
      expect(store.triangles).toBe(0)
    })

    it('reflects updated renderer.info values on each tick', () => {
      const store = usePerfMetricsStore()
      const renderer = makeRenderer(10, 5_000)
      store.setRenderer(renderer)

      store.tick(60, 16)
      expect(store.drawCalls).toBe(10)

      renderer.info.render.calls = 200
      store.tick(60, 16)
      expect(store.drawCalls).toBe(200)
    })

    it('reads heapMB from performance.memory when available', () => {
      const store = usePerfMetricsStore()
      const mockMemory = { usedJSHeapSize: 52_428_800 }
      vi.stubGlobal('performance', { ...performance, memory: mockMemory })

      store.tick(60, 16)
      expect(store.heapMB).toBe(50)

      vi.unstubAllGlobals()
    })

    it('does not throw when performance.memory is absent', () => {
      const store = usePerfMetricsStore()
      const perfWithoutMemory = { now: () => 0 }
      vi.stubGlobal('performance', perfWithoutMemory)

      expect(() => store.tick(60, 16)).not.toThrow()

      vi.unstubAllGlobals()
    })
  })
})
