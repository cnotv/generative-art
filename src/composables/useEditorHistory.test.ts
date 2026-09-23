import { describe, it, expect } from 'vitest'
import { useEditorHistory } from './useEditorHistory'

const trackedHistory = (limit?: number) => {
  const restored: string[] = []
  const history = useEditorHistory<string>(
    'Opened',
    'blank',
    (snapshot) => {
      restored.push(snapshot)
    },
    limit
  )
  return { history, restored }
}

describe('useEditorHistory', () => {
  it('opens with nothing to undo or redo, and an empty log', () => {
    // Arrange, Act
    const { history } = trackedHistory()

    // Assert
    expect(history.canUndo.value).toBe(false)
    expect(history.canRedo.value).toBe(false)
    expect(history.log.value).toEqual([])
  })

  it('restores the state before an action when that action is undone', async () => {
    // Arrange
    const { history, restored } = trackedHistory()
    history.record('Painted', 'red')

    // Act
    await history.undo()

    // Assert
    expect(restored).toEqual(['blank'])
    expect(history.canRedo.value).toBe(true)
  })

  it('restores the state an action produced when it is redone', async () => {
    // Arrange
    const { history, restored } = trackedHistory()
    history.record('Painted', 'red')
    await history.undo()

    // Act
    await history.redo()

    // Assert
    expect(restored).toEqual(['blank', 'red'])
    expect(history.canRedo.value).toBe(false)
  })

  it('restores nothing when there is nothing to step to', async () => {
    // Arrange
    const { history, restored } = trackedHistory()

    // Act
    await history.undo()
    await history.redo()

    // Assert
    expect(restored).toEqual([])
  })

  it('names every action in the log, newest first, marking the undone ones', async () => {
    // Arrange
    const { history } = trackedHistory()
    history.record('Painted', 'red')
    history.record('Erased', 'white')

    // Act
    await history.undo()

    // Assert
    expect(history.log.value).toEqual([
      { label: 'Erased', undone: true },
      { label: 'Painted', undone: false }
    ])
  })

  it('starts over on reopen, so an undo cannot reach what was loaded before', async () => {
    // Arrange
    const { history, restored } = trackedHistory()
    history.record('Painted', 'red')

    // Act
    history.reopen('Opened', 'other model')
    await history.undo()

    // Assert
    expect(restored).toEqual([])
    expect(history.canUndo.value).toBe(false)
    expect(history.state()).toBe('other model')
  })

  it('drops the oldest action once its limit is reached, log included', () => {
    // Arrange
    const { history } = trackedHistory(3)

    // Act
    ;['one', 'two', 'three'].forEach((snapshot) => history.record(`Step ${snapshot}`, snapshot))

    // Assert
    expect(history.log.value.map((entry) => entry.label)).toEqual(['Step three', 'Step two'])
  })
})
