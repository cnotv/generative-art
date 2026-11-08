import { describe, expect, it } from 'vitest'
import { findStrudelFlowNodePosition, separateStrudelFlowNodes } from './layout'
import { createStrudelFlowNodeData } from './nodeDefaults'
import type { StrudelFlowNode, StrudelFlowNodeKind } from './types'

const node = (
  kind: StrudelFlowNodeKind,
  x: number,
  y: number,
  dimensions?: { width: number; height: number }
): StrudelFlowNode => ({
  id: `${kind}-1`,
  type: 'strudel',
  position: { x, y },
  data: createStrudelFlowNodeData(kind),
  dimensions
})

describe('findStrudelFlowNodePosition', () => {
  it('starts the first node at the canvas origin', () => {
    expect(findStrudelFlowNodePosition([], 'filter')).toEqual({ x: 80, y: 120 })
  })

  it('uses the free column beside a tall node', () => {
    const pad = node('pad', 80, 120, { width: 448, height: 524 })

    expect(findStrudelFlowNodePosition([pad], 'chords')).toEqual({ x: 560, y: 120 })
  })

  it('drops below a short node when both columns are taken', () => {
    const pad = node('pad', 80, 120, { width: 448, height: 524 })
    const filter = node('filter', 580, 120, { width: 448, height: 219 })

    expect(findStrudelFlowNodePosition([pad, filter], 'chords')).toEqual({ x: 560, y: 400 })
  })

  it('keeps a gap around every existing node', () => {
    const first = node('filter', 80, 120, { width: 448, height: 219 })
    const second = node('filter', 560, 120, { width: 448, height: 219 })

    const position = findStrudelFlowNodePosition([first, second], 'filter')

    expect(position.y).toBe(400)
  })
})

describe('separateStrudelFlowNodes', () => {
  it('moves a node that sits under a taller one below it and keeps the rest', () => {
    // Arrange
    const samples = { ...node('samples', 80, 100, { width: 480, height: 570 }), id: 'samples-1' }
    const notes = { ...node('notes', 80, 450, { width: 384, height: 300 }), id: 'notes-1' }
    const gain = { ...node('gain', 80, 2000, { width: 256, height: 200 }), id: 'gain-1' }

    // Act
    const result = separateStrudelFlowNodes([samples, notes, gain])

    // Assert
    expect(result.map((item) => item.id)).toEqual(['samples-1', 'notes-1', 'gain-1'])
    expect(result.map((item) => item.position.y)).toEqual([100, 100 + 570 + 32, 2000])
  })
})
