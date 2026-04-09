import { describe, it, expect } from 'vitest'
import {
  historyCreate,
  historyPush,
  historyUndo,
  historyRedo,
  historyCanUndo,
  historyCanRedo
} from './history'

describe('history', () => {
  describe('historyCreate', () => {
    it('should create an empty history stack', () => {
      const stack = historyCreate()
      expect(stack.past).toEqual([])
      expect(stack.future).toEqual([])
    })
  })

  describe('historyPush', () => {
    it('should add a snapshot to past', () => {
      const stack = historyPush(historyCreate(), 'snap1')
      expect(stack.past).toEqual(['snap1'])
    })

    it('should clear future when pushing', () => {
      let stack = historyPush(historyCreate(), 'snap1')
      stack = historyPush(stack, 'snap2')
      const { stack: undone } = historyUndo(stack)
      const pushed = historyPush(undone, 'snap3')
      expect(pushed.future).toEqual([])
    })
  })

  describe('historyUndo', () => {
    it('should return null snapshot when nothing to undo', () => {
      const { snapshot } = historyUndo(historyCreate())
      expect(snapshot).toBeNull()
    })

    it('should move last past snapshot to future', () => {
      let stack = historyPush(historyCreate(), 'snap1')
      stack = historyPush(stack, 'snap2')
      const { stack: after, snapshot } = historyUndo(stack)
      expect(snapshot).toBe('snap1')
      expect(after.past).toEqual(['snap1'])
      expect(after.future).toEqual(['snap2'])
    })

    it('should return null snapshot when only one past entry (restore to blank)', () => {
      const stack = historyPush(historyCreate(), 'snap1')
      const { snapshot } = historyUndo(stack)
      expect(snapshot).toBeNull()
    })
  })

  describe('historyRedo', () => {
    it('should return null snapshot when nothing to redo', () => {
      const { snapshot } = historyRedo(historyCreate())
      expect(snapshot).toBeNull()
    })

    it('should move first future snapshot to past', () => {
      let stack = historyPush(historyCreate(), 'snap1')
      stack = historyPush(stack, 'snap2')
      const { stack: undone } = historyUndo(stack)
      const { stack: redone, snapshot } = historyRedo(undone)
      expect(snapshot).toBe('snap2')
      expect(redone.past).toContain('snap2')
      expect(redone.future).toEqual([])
    })
  })

  describe('historyCanUndo / historyCanRedo', () => {
    it.each([
      [historyCreate(), false, false],
      [historyPush(historyCreate(), 'snap1'), true, false]
    ])('should report correct can-undo/redo state', (stack, expectedUndo, expectedRedo) => {
      expect(historyCanUndo(stack)).toBe(expectedUndo)
      expect(historyCanRedo(stack)).toBe(expectedRedo)
    })

    it('should have redo available after undo', () => {
      let stack = historyPush(historyCreate(), 'snap1')
      stack = historyPush(stack, 'snap2')
      const { stack: after } = historyUndo(stack)
      expect(historyCanRedo(after)).toBe(true)
    })
  })
})
