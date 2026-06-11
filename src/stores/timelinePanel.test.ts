import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTimelinePanelStore, DEFAULT_WINDOW_SECONDS } from './timelinePanel'

describe('useTimelinePanelStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('starts with no source registered and the default window size', () => {
    const store = useTimelinePanelStore()

    expect(store.isAvailable).toBe(false)
    expect(store.source).toBeNull()
    expect(store.windowSeconds).toBe(DEFAULT_WINDOW_SECONDS)
  })

  it('registers a source and exposes it', () => {
    const store = useTimelinePanelStore()
    const source = {
      getTimeline: () => [],
      getCurrentFrame: () => 0,
      getFrameRate: () => 1 / 60
    }

    store.register(source)

    expect(store.isAvailable).toBe(true)
    expect(store.source).toBe(source)
  })

  it('unregisters a source', () => {
    const store = useTimelinePanelStore()
    store.register({ getTimeline: () => [], getCurrentFrame: () => 0, getFrameRate: () => 1 / 60 })

    store.unregister()

    expect(store.isAvailable).toBe(false)
    expect(store.source).toBeNull()
  })

  it.each([
    [5, 5],
    [0, 1],
    [-3, 1]
  ])('clamps window seconds %i to %i', (input, expected) => {
    const store = useTimelinePanelStore()

    store.setWindowSeconds(input)

    expect(store.windowSeconds).toBe(expected)
  })

  it('resets state', () => {
    const store = useTimelinePanelStore()
    store.register({ getTimeline: () => [], getCurrentFrame: () => 0, getFrameRate: () => 1 / 60 })
    store.setWindowSeconds(20)

    store.resetState()

    expect(store.isAvailable).toBe(false)
    expect(store.windowSeconds).toBe(DEFAULT_WINDOW_SECONDS)
  })
})
