import { describe, expect, it } from 'vitest'
import { findStrudelFlowNodePosition } from './layout'
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
