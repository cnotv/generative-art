import { describe, it, expect } from 'vitest'
import {
  historyCanRedo,
  historyCanUndo,
  historyCreate,
  historyLog,
  historyPush,
  historyRedo,
  historyState,
  historyUndo
} from './core'

const openedStack = () => historyCreate('Opened', 'blank', 10)

describe('historyCreate', () => {
  it('starts on the state it was given, with nothing to undo or redo', () => {
    const stack = openedStack()

    expect(historyState(stack)).toBe('blank')
    expect(historyCanUndo(stack)).toBe(false)
    expect(historyCanRedo(stack)).toBe(false)
  })
})

describe('historyPush', () => {
  it('makes the pushed state current and offers it for undo', () => {
    const pushed = historyPush(openedStack(), 'Painted', 'red')

    expect(historyState(pushed)).toBe('red')
    expect(historyCanUndo(pushed)).toBe(true)
  })

  it('drops the oldest states once the limit is reached, keeping the newest', () => {
    const filled = ['a', 'b', 'c', 'd'].reduce(
      (stack, snapshot) => historyPush(stack, `Step ${snapshot}`, snapshot),
      historyCreate('Opened', 'blank', 3)
    )

    expect(filled.past.map((entry) => entry.snapshot)).toEqual(['b', 'c', 'd'])
  })

  it('discards what undo had put aside, so a new branch replaces the old one', () => {
    const undone = historyUndo(historyPush(openedStack(), 'Painted', 'red')).stack

    const branched = historyPush(undone, 'Erased', 'white')

    expect(historyCanRedo(branched)).toBe(false)
    expect(historyState(branched)).toBe('white')
  })
})

describe('historyUndo', () => {
  it('goes back one state and hands it over to be restored', () => {
    const painted = historyPush(openedStack(), 'Painted', 'red')

    const { stack, entry } = historyUndo(painted)

    expect(entry?.snapshot).toBe('blank')
    expect(historyState(stack)).toBe('blank')
    expect(historyCanRedo(stack)).toBe(true)
  })

  it('refuses to undo the state an editor opened on', () => {
    const stack = openedStack()

    const undone = historyUndo(stack)

    expect(undone.entry).toBeNull()
    expect(undone.stack).toBe(stack)
  })

  it('walks back through several steps in the order they were taken', () => {
    const three = ['one', 'two', 'three'].reduce(
      (stack, snapshot) => historyPush(stack, `Step ${snapshot}`, snapshot),
      openedStack()
    )

    const walked = [historyUndo(three), historyUndo(historyUndo(three).stack)]

    expect(walked.map((step) => step.entry?.snapshot)).toEqual(['two', 'one'])
  })
})

describe('historyRedo', () => {
  it('puts back the state undo took away', () => {
    const undone = historyUndo(historyPush(openedStack(), 'Painted', 'red')).stack

    const { stack, entry } = historyRedo(undone)

    expect(entry?.snapshot).toBe('red')
    expect(historyState(stack)).toBe('red')
    expect(historyCanRedo(stack)).toBe(false)
  })

  it('does nothing when nothing was undone', () => {
    const stack = historyPush(openedStack(), 'Painted', 'red')

    const redone = historyRedo(stack)

    expect(redone.entry).toBeNull()
    expect(redone.stack).toBe(stack)
  })
})

describe('historyLog', () => {
  it('lists the actions newest first, leaving out the state the editor opened on', () => {
    const painted = historyPush(historyPush(openedStack(), 'Painted', 'red'), 'Erased', 'white')

    expect(historyLog(painted)).toEqual([
      { label: 'Erased', undone: false },
      { label: 'Painted', undone: false }
    ])
  })

  it('marks an action that was undone, and unmarks it once it is redone', () => {
    const painted = historyPush(historyPush(openedStack(), 'Painted', 'red'), 'Erased', 'white')
    const undone = historyUndo(painted).stack

    expect(historyLog(undone)).toEqual([
      { label: 'Erased', undone: true },
      { label: 'Painted', undone: false }
    ])
    expect(historyLog(historyRedo(undone).stack)).toEqual(historyLog(painted))
  })

  it('is empty on a stack nothing has been done to', () => {
    expect(historyLog(openedStack())).toEqual([])
  })
})
