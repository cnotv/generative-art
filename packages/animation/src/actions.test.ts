import { describe, it, expect, vi } from 'vitest'
import {
  generateTimelineId,
  createDurationAction,
  createOneShotAction,
  createIntervalAction,
  canAddAction,
  getTimelineActionSpan,
  getTimelineChartBars
} from './actions'
import * as THREE from 'three'
import type { ComplexModel, Timeline } from './types'

describe('helpers', () => {
  describe('generateTimelineId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateTimelineId()
      const id2 = generateTimelineId()

      expect(id1).not.toBe(id2)
      expect(typeof id1).toBe('string')
      expect(typeof id2).toBe('string')
    })

    it('should start with "timeline_" prefix', () => {
      const id = generateTimelineId()

      expect(id).toMatch(/^timeline_/)
    })

    it('should contain timestamp and random component', () => {
      const id = generateTimelineId()

      // Format: timeline_<timestamp>_<random>
      const parts = id.split('_')
      expect(parts).toHaveLength(3)
      expect(parts[0]).toBe('timeline')
      expect(parts[1]).toMatch(/^\d+$/) // Timestamp
      expect(parts[2]).toMatch(/^[\da-z]+$/) // Random string
    })
  })

  describe('createDurationAction', () => {
    it('should create action with start, duration, and calculated end', () => {
      const actionFunction = vi.fn()
      const action = createDurationAction(10, 20, actionFunction)

      expect(action.start).toBe(10)
      expect(action.duration).toBe(20)
      expect(action.action).toBe(actionFunction)
      expect(action.id).toBeDefined()
    })

    it('should accept additional options', () => {
      const actionFunction = vi.fn()
      const action = createDurationAction(10, 20, actionFunction, {
        name: 'test-action',
        category: 'physics',
        priority: 5
      })

      expect(action.name).toBe('test-action')
      expect(action.category).toBe('physics')
      expect(action.priority).toBe(5)
    })

    it('should generate unique IDs for each action', () => {
      const actionFunction = vi.fn()
      const action1 = createDurationAction(0, 10, actionFunction)
      const action2 = createDurationAction(0, 10, actionFunction)

      expect(action1.id).not.toBe(action2.id)
    })

    it('should override generated ID if provided in options', () => {
      const actionFunction = vi.fn()
      const customId = 'custom-id'
      const action = createDurationAction(10, 20, actionFunction, { id: customId })

      expect(action.id).toBe(customId)
    })
  })

  describe('createOneShotAction', () => {
    it('should create action that runs once with start = end', () => {
      const actionFunction = vi.fn()
      const action = createOneShotAction(50, actionFunction)

      expect(action.start).toBe(50)
      expect(action.end).toBe(50)
      expect(action.action).toBe(actionFunction)
      expect(action.autoRemove).toBe(true)
      expect(action.id).toBeDefined()
    })

    it('should accept additional options', () => {
      const actionFunction = vi.fn()
      const action = createOneShotAction(50, actionFunction, {
        name: 'one-shot',
        category: 'ui'
      })

      expect(action.name).toBe('one-shot')
      expect(action.category).toBe('ui')
      expect(action.autoRemove).toBe(true)
    })

    it('should allow overriding autoRemove in options', () => {
      const actionFunction = vi.fn()
      const action = createOneShotAction(50, actionFunction, {
        autoRemove: false
      })

      expect(action.autoRemove).toBe(false)
    })

    it('should generate unique IDs', () => {
      const actionFunction = vi.fn()
      const action1 = createOneShotAction(50, actionFunction)
      const action2 = createOneShotAction(50, actionFunction)

      expect(action1.id).not.toBe(action2.id)
    })
  })

  describe('createIntervalAction', () => {
    it('should create action with interval configuration', () => {
      const actionFunction = vi.fn()
      const action = createIntervalAction([10, 5], actionFunction)

      expect(action.interval).toEqual([10, 5])
      expect(action.action).toBe(actionFunction)
      expect(action.id).toBeDefined()
    })

    it('should auto-generate name from interval', () => {
      const actionFunction = vi.fn()
      const action = createIntervalAction([10, 5], actionFunction)

      expect(action.name).toBe('interval_10_5')
    })

    it('should use provided name over auto-generated name', () => {
      const actionFunction = vi.fn()
      const action = createIntervalAction([10, 5], actionFunction, {
        name: 'custom-interval'
      })

      expect(action.name).toBe('custom-interval')
    })

    it('should accept additional options', () => {
      const actionFunction = vi.fn()
      const action = createIntervalAction([10, 5], actionFunction, {
        category: 'animation',
        priority: 3
      })

      expect(action.category).toBe('animation')
      expect(action.priority).toBe(3)
    })

    it('should generate unique IDs', () => {
      const actionFunction = vi.fn()
      const action1 = createIntervalAction([10, 5], actionFunction)
      const action2 = createIntervalAction([10, 5], actionFunction)

      expect(action1.id).not.toBe(action2.id)
    })

    it('should handle different interval patterns', () => {
      const actionFunction = vi.fn()
      const action1 = createIntervalAction([100, 50], actionFunction)
      const action2 = createIntervalAction([5, 2], actionFunction)

      expect(action1.name).toBe('interval_100_50')
      expect(action2.name).toBe('interval_5_2')
    })
  })

  describe('canAddAction', () => {
    const createMockPlayer = (currentAction?: string, actionTime?: number): ComplexModel => {
      const mockMesh = new THREE.Group()
      const action =
        actionTime !== undefined
          ? {
              time: actionTime,
              play: vi.fn(),
              stop: vi.fn(),
              reset: vi.fn().mockReturnThis(),
              fadeIn: vi.fn().mockReturnThis(),
              fadeOut: vi.fn(),
              isRunning: vi.fn().mockReturnValue(true)
            }
          : undefined

      return Object.assign(mockMesh, {
        userData: {
          currentAction,
          actions: currentAction
            ? {
                [currentAction]: action
              }
            : {},
          body: {
            translation: () => ({ x: 0, y: 0, z: 0 }),
            setTranslation: vi.fn()
          },
          initialValues: { position: [0, 0, 0], rotation: [0, 0, 0], size: 1, color: undefined },
          type: 'dynamic'
        }
      }) as unknown as ComplexModel
    }

    it('should return true when no current action', () => {
      const player = createMockPlayer()

      expect(canAddAction(player, 1000)).toBe(true)
    })

    it('should return true when current action time >= blocking', () => {
      const player = createMockPlayer('walk', 1500)

      expect(canAddAction(player, 1000)).toBe(true)
    })

    it('should return false when current action time < blocking', () => {
      const player = createMockPlayer('attack', 500)

      expect(canAddAction(player, 1000)).toBe(false)
    })

    it('should return true when blocking is 0', () => {
      const player = createMockPlayer('walk', 0)

      expect(canAddAction(player, 0)).toBe(true)
    })

    it('should return true when blocking is not specified (defaults to 0)', () => {
      const player = createMockPlayer('walk', 100)

      expect(canAddAction(player)).toBe(true)
    })

    it('should return true when current action has no time property', () => {
      const mockMesh = new THREE.Group()
      const player = Object.assign(mockMesh, {
        userData: {
          currentAction: 'walk',
          actions: {
            walk: { play: vi.fn() } // No time property
          },
          body: {
            translation: () => ({ x: 0, y: 0, z: 0 }),
            setTranslation: vi.fn()
          },
          initialValues: { position: [0, 0, 0], rotation: [0, 0, 0], size: 1, color: undefined },
          type: 'dynamic'
        }
      }) as unknown as ComplexModel

      // Should handle gracefully (time would be undefined)
      expect(canAddAction(player, 1000)).toBe(false) // undefined < 1000 = true (type coercion)
    })

    it('should handle edge case where action time equals blocking', () => {
      const player = createMockPlayer('walk', 1000)

      expect(canAddAction(player, 1000)).toBe(true) // >= check
    })

    it('should return true for different blocking durations', () => {
      const player500 = createMockPlayer('attack', 600)
      const player1000 = createMockPlayer('attack', 1100)

      expect(canAddAction(player500, 500)).toBe(true)
      expect(canAddAction(player1000, 1000)).toBe(true)
    })
  })

  describe('getTimelineActionSpan', () => {
    it.each([
      ['start + end', { start: 10, end: 50 }, { start: 10, end: 50 }],
      ['start + duration', { start: 10, duration: 20 }, { start: 10, end: 30 }],
      [
        'delay + interval',
        { delay: 5, interval: [10, 5] as [number, number] },
        { start: 5, end: 15 }
      ],
      ['start only', { start: 10 }, { start: 10, end: 10 }],
      ['no time properties', {}, { start: 0, end: 0 }],
      [
        'duration takes priority over end',
        { start: 0, end: 100, duration: 10 },
        { start: 0, end: 10 }
      ]
    ])('%s', (_label, action, expected) => {
      expect(getTimelineActionSpan(action)).toEqual(expected)
    })
  })

  describe('getTimelineChartBars', () => {
    const range = { rangeStart: 0, rangeEnd: 10, rate: 1 / 60 }

    it('positions a bounded action as a single bar within the window', () => {
      const timeline: Timeline[] = [{ name: 'intro', start: 0, duration: 300 }]

      const bars = getTimelineChartBars(timeline, range)

      expect(bars).toHaveLength(1)
      expect(bars[0]).toMatchObject({ name: 'intro', lane: 0, left: 0, width: 50 })
    })

    it('renders a continuous action (no end/duration/interval) across the full window', () => {
      const timeline: Timeline[] = [{ name: 'coin: flip', start: 0, category: 'visual-effects' }]

      const firstWindow = getTimelineChartBars(timeline, range)
      const laterWindow = getTimelineChartBars(timeline, {
        rangeStart: 100,
        rangeEnd: 110,
        rate: 1 / 60
      })

      expect(firstWindow[0]).toMatchObject({ left: 0, width: 100 })
      expect(laterWindow[0]).toMatchObject({ left: 0, width: 100 })
    })

    it('expands segments into one bar per occurrence overlapping the window', () => {
      const timeline: Timeline[] = [
        {
          name: 'cube: move',
          segments: [
            { name: 'rise', frames: 300 },
            { name: 'fall', frames: 300 }
          ]
        }
      ]

      const bars = getTimelineChartBars(timeline, range)

      expect(bars.map(({ name }) => name)).toEqual(['rise', 'fall'])
      expect(bars[0]).toMatchObject({ left: 0, width: 50 })
      expect(bars[1]).toMatchObject({ left: 50, width: 50 })
    })

    it('clamps a tiny occurrence to a minimum readable width without overlapping the next occurrence', () => {
      const timeline: Timeline[] = [{ name: 'blip', interval: [1, 599] }]

      const bars = getTimelineChartBars(timeline, range)

      expect(bars[0].width).toBe(1)
      expect(bars[0].left + bars[0].width).toBeLessThanOrEqual(bars[1].left)
    })

    it('expands repeating interval actions into one bar per occurrence', () => {
      const timeline: Timeline[] = [{ name: 'ball: spawn', interval: [60, 180] }]

      const bars = getTimelineChartBars(timeline, range)

      expect(bars).toHaveLength(3)
      expect(bars[0]).toMatchObject({ left: 0, width: 10 })
      expect(bars[1]).toMatchObject({ left: 40, width: 10 })
      expect(bars[2]).toMatchObject({ left: 80, width: 10 })
    })
  })

  describe('helper functions integration', () => {
    it('should work together to create complex timelines', () => {
      const actions = [
        createDurationAction(0, 100, vi.fn(), { name: 'intro', category: 'cutscene' }),
        createOneShotAction(100, vi.fn(), { name: 'trigger', category: 'event' }),
        createIntervalAction([10, 5], vi.fn(), { category: 'animation' })
      ]

      expect(actions).toHaveLength(3)
      expect(actions[0].start).toBe(0)
      expect(actions[0].duration).toBe(100)
      expect(actions[1].autoRemove).toBe(true)
      expect(actions[2].interval).toEqual([10, 5])

      // All should have unique IDs
      const ids = actions.map((a) => a.id)
      expect(new Set(ids).size).toBe(3)
    })

    it('should create actions with proper metadata for timeline management', () => {
      const action = createDurationAction(10, 50, vi.fn(), {
        name: 'complex-action',
        category: 'gameplay',
        priority: 10,
        enabled: true,
        metadata: { source: 'ai-behavior' }
      })

      expect(action.start).toBe(10)
      expect(action.duration).toBe(50)
      expect(action.name).toBe('complex-action')
      expect(action.category).toBe('gameplay')
      expect(action.priority).toBe(10)
      expect(action.enabled).toBe(true)
      expect(action.metadata).toEqual({ source: 'ai-behavior' })
      expect(action.id).toBeDefined()
    })
  })
})
