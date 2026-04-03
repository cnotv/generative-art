import { describe, it, expect, beforeEach, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'

// Mock route query
const mockQuery = ref<Record<string, string | undefined>>({})
const mockPath = ref('/test')
const mockPush = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockPush
  }),
  useRoute: () => ({
    get query() {
      return mockQuery.value
    },
    get path() {
      return mockPath.value
    }
  })
}))

// Import after mocking
import { usePanelsStore } from './panels'

// Closed panels are omitted from URL (undefined removes the param)
const allPanelsClosed = {
  navigation: undefined,
  config: undefined,
  scene: undefined,
  debug: undefined,
  elements: undefined
}

describe('usePanelsStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockQuery.value = {}
    mockPath.value = '/test'
    setActivePinia(createPinia())
  })

  describe('togglePanel', () => {
    it('should open config panel and sync query param', async () => {
      const store = usePanelsStore()
      store.initRouteSync()

      store.togglePanel('config')
      await nextTick()

      expect(store.isConfigOpen).toBe(true)
      expect(mockPush).toHaveBeenCalledWith({
        path: '/test',
        query: { ...allPanelsClosed, config: 'true' }
      })
    })

    it('should close config panel and remove query param', async () => {
      const store = usePanelsStore()
      store.initRouteSync()

      // First toggle opens it
      store.togglePanel('config')
      await nextTick()

      // Second toggle closes it
      store.togglePanel('config')
      await nextTick()

      expect(store.isConfigOpen).toBe(false)
      expect(mockPush).toHaveBeenLastCalledWith({
        path: '/test',
        query: { ...allPanelsClosed }
      })
    })
  })

  describe('closePanel', () => {
    it('should close panel and remove query param', async () => {
      const store = usePanelsStore()
      store.initRouteSync()

      // Open first
      store.togglePanel('config')
      await nextTick()

      // Then close
      store.closePanel('config')
      await nextTick()

      expect(store.isConfigOpen).toBe(false)
      expect(mockPush).toHaveBeenLastCalledWith({
        path: '/test',
        query: { ...allPanelsClosed }
      })
    })

    it('should preserve other query params when closing', async () => {
      mockQuery.value = { config: 'true', other: 'value' }
      const store = usePanelsStore()
      store.initRouteSync()

      store.closePanel('config')
      await nextTick()

      expect(mockPush).toHaveBeenCalledWith({
        path: '/test',
        query: { ...allPanelsClosed, other: 'value' }
      })
    })
  })

  describe('openPanel', () => {
    it('should open panel and add query param', async () => {
      const store = usePanelsStore()
      store.initRouteSync()

      store.openPanel('config')
      await nextTick()

      expect(store.isConfigOpen).toBe(true)
      expect(mockPush).toHaveBeenCalledWith({
        path: '/test',
        query: { ...allPanelsClosed, config: 'true' }
      })
    })
  })

  describe('navigation panel', () => {
    it('should sync navigation query param', async () => {
      const store = usePanelsStore()
      store.initRouteSync()

      store.togglePanel('navigation')
      await nextTick()

      expect(store.isNavigationOpen).toBe(true)
      expect(mockPush).toHaveBeenCalledWith({
        path: '/test',
        query: { ...allPanelsClosed, navigation: 'true' }
      })
    })
  })

  describe('mutual exclusion', () => {
    it('should close all other panels when navigation is opened', async () => {
      const store = usePanelsStore()
      store.initRouteSync()

      store.openPanel('config')
      store.openPanel('scene')
      await nextTick()
      expect(store.isConfigOpen).toBe(true)
      expect(store.isSceneOpen).toBe(true)

      store.togglePanel('navigation')
      await nextTick()

      expect(store.isNavigationOpen).toBe(true)
      expect(store.isConfigOpen).toBe(false)
      expect(store.isSceneOpen).toBe(false)
    })

    it('should close navigation when any other panel is opened', async () => {
      const store = usePanelsStore()
      store.initRouteSync()

      store.togglePanel('navigation')
      await nextTick()
      expect(store.isNavigationOpen).toBe(true)

      store.openPanel('config')
      await nextTick()

      expect(store.isNavigationOpen).toBe(false)
      expect(store.isConfigOpen).toBe(true)
    })

    it('should close navigation when toggling another panel open', async () => {
      const store = usePanelsStore()
      store.initRouteSync()

      store.togglePanel('navigation')
      await nextTick()
      expect(store.isNavigationOpen).toBe(true)

      store.togglePanel('debug')
      await nextTick()

      expect(store.isNavigationOpen).toBe(false)
      expect(store.isDebugOpen).toBe(true)
    })
  })

  describe('query param initialization', () => {
    it('should open config panel if query param is present on init', async () => {
      mockQuery.value = { config: 'true' }

      const store = usePanelsStore()
      store.initRouteSync()
      await nextTick()

      expect(store.isConfigOpen).toBe(true)
    })
  })

  describe('URL query param — undefined and partial values', () => {
    it('opens only elements when URL has elements=true and all others as false', async () => {
      mockQuery.value = {
        navigation: 'false',
        config: 'false',
        scene: 'false',
        debug: 'false',
        elements: 'true'
      }

      const store = usePanelsStore()
      store.initRouteSync()
      await nextTick()

      expect(store.activePanels.has('elements')).toBe(true)
      expect(store.activePanels.has('navigation')).toBe(false)
      expect(store.activePanels.has('config')).toBe(false)
      expect(store.activePanels.has('scene')).toBe(false)
      expect(store.activePanels.has('debug')).toBe(false)
    })

    it('keeps all panels closed when all URL params are false', async () => {
      mockQuery.value = {
        navigation: 'false',
        config: 'false',
        scene: 'false',
        debug: 'false',
        elements: 'false'
      }

      const store = usePanelsStore()
      store.initRouteSync()
      await nextTick()

      expect(store.activePanels.size).toBe(0)
    })

    it('treats absent URL params as closed', async () => {
      mockQuery.value = { elements: 'true' }

      const store = usePanelsStore()
      store.initRouteSync()
      await nextTick()

      expect(store.activePanels.has('elements')).toBe(true)
      expect(store.activePanels.has('navigation')).toBe(false)
      expect(store.activePanels.has('config')).toBe(false)
      expect(store.activePanels.has('scene')).toBe(false)
      expect(store.activePanels.has('debug')).toBe(false)
    })

    it.each([[undefined], [''], ['false'], ['1'], ['yes'], ['TRUE']])(
      'treats param value %j as closed — does not open the panel',
      async (value) => {
        mockQuery.value = { elements: value }

        const store = usePanelsStore()
        store.initRouteSync()
        await nextTick()

        expect(store.activePanels.has('elements')).toBe(false)
      }
    )

    it('togglePanel works correctly when some URL params are absent', async () => {
      mockQuery.value = { elements: 'false' }

      const store = usePanelsStore()
      store.initRouteSync()

      store.togglePanel('config')
      await nextTick()

      expect(store.isConfigOpen).toBe(true)
      expect(mockPush).toHaveBeenCalledWith({
        path: '/test',
        query: { ...allPanelsClosed, config: 'true' }
      })
    })

    it('togglePanel does not throw when URL params contain undefined values', async () => {
      mockQuery.value = {
        navigation: undefined,
        config: undefined,
        scene: 'false',
        debug: 'false',
        elements: 'true'
      }

      const store = usePanelsStore()
      store.initRouteSync()
      await nextTick()

      expect(store.activePanels.has('elements')).toBe(true)
      expect(() => store.togglePanel('config')).not.toThrow()
      await nextTick()

      expect(store.isConfigOpen).toBe(true)
    })

    it('watcher closes panel when URL param changes from true to undefined', async () => {
      mockQuery.value = { elements: 'true' }

      const store = usePanelsStore()
      store.initRouteSync()
      await nextTick()
      expect(store.activePanels.has('elements')).toBe(true)

      mockQuery.value = {}
      await nextTick()

      expect(store.activePanels.has('elements')).toBe(false)
    })

    it('watcher opens panel when URL param changes from undefined to true', async () => {
      mockQuery.value = {}

      const store = usePanelsStore()
      store.initRouteSync()
      await nextTick()
      expect(store.activePanels.has('elements')).toBe(false)

      mockQuery.value = { elements: 'true' }
      await nextTick()

      expect(store.activePanels.has('elements')).toBe(true)
    })

    it('watcher opens panel when URL param changes from false to true', async () => {
      mockQuery.value = { elements: 'false' }

      const store = usePanelsStore()
      store.initRouteSync()
      await nextTick()
      expect(store.activePanels.has('elements')).toBe(false)

      mockQuery.value = { elements: 'true' }
      await nextTick()

      expect(store.activePanels.has('elements')).toBe(true)
    })

    it('openPanel writes all panel params to URL even when some were undefined in the URL', async () => {
      mockQuery.value = { elements: 'true' }

      const store = usePanelsStore()
      store.initRouteSync()
      await nextTick()

      store.openPanel('scene')
      await nextTick()

      expect(mockPush).toHaveBeenLastCalledWith({
        path: '/test',
        query: { ...allPanelsClosed, elements: 'true', scene: 'true' }
      })
    })
  })

  describe('overlay click simulation (handleOpenChange)', () => {
    it('should close panel and update URL when overlay is clicked', async () => {
      const store = usePanelsStore()
      store.initRouteSync()

      // Open the panel first
      store.togglePanel('config')
      await nextTick()
      expect(store.isConfigOpen).toBe(true)
      expect(mockPush).toHaveBeenCalledWith({
        path: '/test',
        query: { ...allPanelsClosed, config: 'true' }
      })

      vi.clearAllMocks()

      // Simulate overlay click by calling closePanel (what handleOpenChange does)
      store.closePanel('config')
      await nextTick()

      expect(store.isConfigOpen).toBe(false)
      expect(mockPush).toHaveBeenCalledTimes(1)
      expect(mockPush).toHaveBeenCalledWith({
        path: '/test',
        query: { ...allPanelsClosed }
      })
    })

    it('should update URL even when called multiple times', async () => {
      const store = usePanelsStore()
      store.initRouteSync()

      // Open -> Close -> Open -> Close
      store.togglePanel('config')
      await nextTick()
      expect(store.isConfigOpen).toBe(true)

      store.closePanel('config')
      await nextTick()
      expect(store.isConfigOpen).toBe(false)

      store.togglePanel('config')
      await nextTick()
      expect(store.isConfigOpen).toBe(true)

      store.closePanel('config')
      await nextTick()
      expect(store.isConfigOpen).toBe(false)

      // Should have been called 4 times (open, close, open, close)
      expect(mockPush).toHaveBeenCalledTimes(4)
    })
  })

  describe('multiple panels', () => {
    it('should allow multiple non-navigation panels to be open simultaneously', async () => {
      const store = usePanelsStore()
      store.initRouteSync()

      store.togglePanel('config')
      await nextTick()
      expect(store.isConfigOpen).toBe(true)

      store.togglePanel('scene')
      await nextTick()
      expect(store.isConfigOpen).toBe(true)
      expect(store.isSceneOpen).toBe(true)

      store.togglePanel('config')
      await nextTick()
      expect(store.isConfigOpen).toBe(false)
      expect(store.isSceneOpen).toBe(true)
    })

    it('should close specific panel with closePanel', async () => {
      const store = usePanelsStore()
      store.initRouteSync()

      store.openPanel('config')
      store.openPanel('scene')
      await nextTick()
      expect(store.isConfigOpen).toBe(true)
      expect(store.isSceneOpen).toBe(true)

      store.closePanel('config')
      await nextTick()
      expect(store.isConfigOpen).toBe(false)
      expect(store.isSceneOpen).toBe(true)
    })
  })

  describe('getPanelOffset', () => {
    it.each([
      // Right-side panels — single panel open always has offset 0
      ['debug', ['debug'], 0],
      ['scene', ['scene'], 0],
      ['config', ['config'], 0],
      // Right-side panels — multiple open, offset by count of panels closer to edge
      ['config', ['debug', 'config'], 1],
      ['config', ['scene', 'config'], 1],
      ['config', ['debug', 'scene', 'config'], 2],
      ['scene', ['debug', 'scene'], 1],
      ['debug', ['debug', 'scene', 'config'], 0],
      ['scene', ['debug', 'scene', 'config'], 1],
      ['config', ['debug', 'scene', 'config'], 2],
      // Left-side panels — single panel open always has offset 0
      ['elements', ['elements'], 0]
    ] as const)(
      'getPanelOffset(%s) with open panels %j → %d',
      async (panelType, openPanels, expectedOffset) => {
        const store = usePanelsStore()
        store.initRouteSync()

        openPanels.forEach((p) => store.openPanel(p))
        await nextTick()

        expect(store.getPanelOffset(panelType)).toBe(expectedOffset)
      }
    )
  })
})
