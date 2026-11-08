import { describe, expect, it } from 'vitest'
import { isStrudelFlowSoloed, planStrudelFlowSolo } from './solo'
import type { StrudelFlowEdge, StrudelFlowNode } from './types'

const node = (
  id: string,
  kind: 'pad' | 'beats' | 'voice' | 'gain',
  muted = false
): StrudelFlowNode =>
  ({
    id,
    type: 'strudel',
    position: { x: 0, y: 0 },
    data: kind === 'gain' ? { kind, gain: 0.5 } : { kind, ...(muted ? { muted } : {}) }
  }) as StrudelFlowNode

const edge = (source: string, target: string): StrudelFlowEdge => ({
  id: `${source}-${target}`,
  source,
  target
})

describe('planStrudelFlowSolo', () => {
  it('mutes every other instrument and leaves effects alone', () => {
    // Arrange
    const nodes = [node('a', 'pad'), node('b', 'beats'), node('c', 'gain')]

    // Act
    const plan = planStrudelFlowSolo(nodes, [], 'a')

    // Assert
    expect(plan).toEqual([{ nodeId: 'b', muted: true }])
  })

  it('unmutes the soloed instrument when it was muted', () => {
    // Arrange
    const nodes = [node('a', 'pad', true), node('b', 'beats')]

    // Act
    const plan = planStrudelFlowSolo(nodes, [], 'a')

    // Assert
    expect(plan).toEqual([
      { nodeId: 'a', muted: false },
      { nodeId: 'b', muted: true }
    ])
  })

  it('unmutes everything when the instrument is already soloed', () => {
    // Arrange
    const nodes = [node('a', 'pad'), node('b', 'beats', true)]

    // Act
    const plan = planStrudelFlowSolo(nodes, [], 'a')

    // Assert
    expect(isStrudelFlowSoloed(nodes, [], 'a')).toBe(true)
    expect(plan).toEqual([{ nodeId: 'b', muted: false }])
  })

  it('solos the instrument a voice is wired to', () => {
    // Arrange
    const nodes = [node('a', 'pad'), node('b', 'beats'), node('v', 'voice')]
    const edges = [edge('a', 'v')]

    // Act
    const plan = planStrudelFlowSolo(nodes, edges, 'v')

    // Assert
    expect(plan).toEqual([{ nodeId: 'b', muted: true }])
  })

  it('is not a solo when one instrument is all there is', () => {
    expect(isStrudelFlowSoloed([node('a', 'pad')], [], 'a')).toBe(false)
  })
})
