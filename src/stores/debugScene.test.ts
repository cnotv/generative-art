import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { CoordinateTuple } from '@webgamekit/threejs'
import { useDebugSceneStore } from './debugScene'
import type { PathConfig, PathHandlers, PathEntry } from './debugScene'

const makePathConfig = (overrides: Partial<PathConfig> = {}): PathConfig => ({
  speed: 10,
  obstacleImpulse: 0,
  easing: 'linear',
  easingIntensity: 1,
  playing: true,
  loop: false,
  pingPong: false,
  showPath: true,
  showNodes: false,
  ...overrides
})

const makeHandlers = (): PathHandlers => ({
  onAddWaypoint: vi.fn(),
  onRemoveWaypoint: vi.fn(),
  onUpdateWaypoint: vi.fn(),
  onReset: vi.fn(),
  onToggleVisibility: vi.fn(),
  onRemove: vi.fn(),
  onConfigChange: vi.fn()
})

const makePathEntry = (id: string, elementName: string, handlers = makeHandlers()): PathEntry => ({
  id,
  elementName,
  label: `${elementName} path`,
  waypoints: [],
  config: makePathConfig(),
  handlers
})

describe('useDebugSceneStore — paths', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('addPath', () => {
    it('adds an entry to paths', () => {
      const store = useDebugSceneStore()
      store.addPath(makePathEntry('p1', 'brick-1'))
      expect(store.paths).toHaveLength(1)
      expect(store.paths[0].id).toBe('p1')
    })

    it('replaces an existing entry with the same id', () => {
      const store = useDebugSceneStore()
      store.addPath(makePathEntry('p1', 'brick-1'))
      store.addPath({ ...makePathEntry('p1', 'brick-1'), label: 'updated' })
      expect(store.paths).toHaveLength(1)
      expect(store.paths[0].label).toBe('updated')
    })

    it('preserves hidden flag from existing entry on re-add', () => {
      const store = useDebugSceneStore()
      store.addPath(makePathEntry('p1', 'brick-1'))
      store.togglePathVisibility('p1')
      store.addPath(makePathEntry('p1', 'brick-1'))
      expect(store.paths[0].hidden).toBe(true)
    })
  })

  describe('removePath', () => {
    it('removes the entry', () => {
      const store = useDebugSceneStore()
      store.addPath(makePathEntry('p1', 'brick-1'))
      store.removePath('p1')
      expect(store.paths).toHaveLength(0)
    })

    it('calls onRemove handler', () => {
      const store = useDebugSceneStore()
      const handlers = makeHandlers()
      store.addPath(makePathEntry('p1', 'brick-1', handlers))
      store.removePath('p1')
      expect(handlers.onRemove).toHaveBeenCalledOnce()
    })
  })

  describe('togglePathVisibility', () => {
    it('flips hidden flag', () => {
      const store = useDebugSceneStore()
      store.addPath(makePathEntry('p1', 'brick-1'))
      store.togglePathVisibility('p1')
      expect(store.paths[0].hidden).toBe(true)
      store.togglePathVisibility('p1')
      expect(store.paths[0].hidden).toBe(false)
    })

    it('calls onToggleVisibility handler with new hidden value', () => {
      const store = useDebugSceneStore()
      const handlers = makeHandlers()
      store.addPath(makePathEntry('p1', 'brick-1', handlers))
      store.togglePathVisibility('p1')
      expect(handlers.onToggleVisibility).toHaveBeenCalledWith(true)
    })
  })

  describe('addPathWaypoint', () => {
    it('appends a waypoint to the path', () => {
      const store = useDebugSceneStore()
      store.addPath(makePathEntry('p1', 'brick-1'))
      const position: CoordinateTuple = [1, 0, 2]
      store.addPathWaypoint('p1', position)
      expect(store.paths[0].waypoints).toHaveLength(1)
      expect(store.paths[0].waypoints[0]).toEqual(position)
    })

    it('calls onAddWaypoint handler', () => {
      const store = useDebugSceneStore()
      const handlers = makeHandlers()
      store.addPath(makePathEntry('p1', 'brick-1', handlers))
      store.addPathWaypoint('p1', [0, 0, 0])
      expect(handlers.onAddWaypoint).toHaveBeenCalledWith([0, 0, 0])
    })
  })

  describe('removePathWaypoint', () => {
    it('removes waypoint at index', () => {
      const store = useDebugSceneStore()
      store.addPath({
        ...makePathEntry('p1', 'brick-1'),
        waypoints: [
          [0, 0, 0],
          [1, 0, 1]
        ]
      })
      store.removePathWaypoint('p1', 0)
      expect(store.paths[0].waypoints).toHaveLength(1)
      expect(store.paths[0].waypoints[0]).toEqual([1, 0, 1])
    })

    it('calls onRemoveWaypoint handler', () => {
      const store = useDebugSceneStore()
      const handlers = makeHandlers()
      store.addPath({ ...makePathEntry('p1', 'brick-1', handlers), waypoints: [[0, 0, 0]] })
      store.removePathWaypoint('p1', 0)
      expect(handlers.onRemoveWaypoint).toHaveBeenCalledWith(0)
    })
  })

  describe('updatePathWaypoint', () => {
    it('replaces the waypoint at given index', () => {
      const store = useDebugSceneStore()
      const pos: CoordinateTuple = [5, 0, 5]
      store.addPath({ ...makePathEntry('p1', 'brick-1'), waypoints: [[0, 0, 0]] })
      store.updatePathWaypoint('p1', 0, pos)
      expect(store.paths[0].waypoints[0]).toEqual(pos)
    })

    it('calls onUpdateWaypoint handler', () => {
      const store = useDebugSceneStore()
      const handlers = makeHandlers()
      const pos: CoordinateTuple = [3, 0, 3]
      store.addPath({ ...makePathEntry('p1', 'brick-1', handlers), waypoints: [[0, 0, 0]] })
      store.updatePathWaypoint('p1', 0, pos)
      expect(handlers.onUpdateWaypoint).toHaveBeenCalledWith(0, pos)
    })
  })

  describe('updatePathConfig', () => {
    it('updates a single config key', () => {
      const store = useDebugSceneStore()
      store.addPath(makePathEntry('p1', 'brick-1'))
      store.updatePathConfig('p1', 'speed', 25)
      expect(store.paths[0].config.speed).toBe(25)
    })

    it('calls onConfigChange handler', () => {
      const store = useDebugSceneStore()
      const handlers = makeHandlers()
      store.addPath(makePathEntry('p1', 'brick-1', handlers))
      store.updatePathConfig('p1', 'loop', true)
      expect(handlers.onConfigChange).toHaveBeenCalledWith('loop', true)
    })
  })

  describe('clearSceneElements', () => {
    it('clears paths along with other collections', () => {
      const store = useDebugSceneStore()
      store.addPath(makePathEntry('p1', 'brick-1'))
      store.clearSceneElements()
      expect(store.paths).toHaveLength(0)
    })
  })

  describe('registerPathContext / enablePathForElement', () => {
    it('calls onEnablePath when enablePathForElement is invoked', () => {
      const store = useDebugSceneStore()
      const onEnablePath = vi.fn()
      store.registerPathContext({ onEnablePath })
      store.enablePathForElement('brick-1')
      expect(onEnablePath).toHaveBeenCalledWith('brick-1')
    })

    it('does nothing if no context is registered', () => {
      const store = useDebugSceneStore()
      expect(() => store.enablePathForElement('brick-1')).not.toThrow()
    })

    it('stops calling handler after unregisterPathContext', () => {
      const store = useDebugSceneStore()
      const onEnablePath = vi.fn()
      store.registerPathContext({ onEnablePath })
      store.unregisterPathContext()
      store.enablePathForElement('brick-1')
      expect(onEnablePath).not.toHaveBeenCalled()
    })
  })
})
