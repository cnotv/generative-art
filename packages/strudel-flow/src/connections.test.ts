import { describe, expect, it } from 'vitest'
import { canConnectStrudelFlowNodes, canUseStrudelFlowConnection } from './connections'
import { createStrudelFlowNodeData } from './nodeDefaults'
import type {
  StrudelFlowEdge,
  StrudelFlowNode,
  StrudelFlowNodeData,
  StrudelFlowNodeKind
} from './types'

const createNode = (id: string, data: StrudelFlowNodeData): StrudelFlowNode => ({
  id,
  type: 'strudel',
  position: { x: 0, y: 0 },
  data
})

const createEdge = (source: string, target: string): StrudelFlowEdge => ({
  id: `${source}-${target}`,
  source,
  target
})

const createNodes = (kinds: [string, StrudelFlowNodeKind][]): StrudelFlowNode[] =>
  kinds.map(([id, kind]) => createNode(id, createStrudelFlowNodeData(kind)))

describe('canConnectStrudelFlowNodes', () => {
  it('lets an instrument feed an effect', () => {
    // Arrange
    const nodes = createNodes([
      ['pad', 'pad'],
      ['filter', 'filter']
    ])

    // Act
    const canConnect = canConnectStrudelFlowNodes('pad', 'filter', nodes, [])

    // Assert
    expect(canConnect).toBe(true)
  })

  it('chains one effect into another', () => {
    // Arrange
    const nodes = createNodes([
      ['pad', 'pad'],
      ['filter', 'filter'],
      ['delay', 'delay']
    ])

    // Act
    const canConnect = canConnectStrudelFlowNodes('filter', 'delay', nodes, [
      createEdge('pad', 'filter')
    ])

    // Assert
    expect(canConnect).toBe(true)
  })

  it('refuses a node feeding itself', () => {
    // Arrange
    const nodes = createNodes([['filter', 'filter']])

    // Act
    const canConnect = canConnectStrudelFlowNodes('filter', 'filter', nodes, [])

    // Assert
    expect(canConnect).toBe(false)
  })

  it('refuses a cable into an instrument', () => {
    // Arrange
    const nodes = createNodes([
      ['filter', 'filter'],
      ['beats', 'beats']
    ])

    // Act
    const canConnect = canConnectStrudelFlowNodes('filter', 'beats', nodes, [])

    // Assert
    expect(canConnect).toBe(false)
  })

  it('refuses the same cable twice', () => {
    // Arrange
    const nodes = createNodes([
      ['pad', 'pad'],
      ['filter', 'filter']
    ])

    // Act
    const canConnect = canConnectStrudelFlowNodes('pad', 'filter', nodes, [
      createEdge('pad', 'filter')
    ])

    // Assert
    expect(canConnect).toBe(false)
  })

  it('refuses a cable that closes a loop', () => {
    // Arrange
    const nodes = createNodes([
      ['pad', 'pad'],
      ['filter', 'filter'],
      ['delay', 'delay']
    ])

    // Act
    const canConnect = canConnectStrudelFlowNodes('delay', 'filter', nodes, [
      createEdge('pad', 'filter'),
      createEdge('filter', 'delay')
    ])

    // Assert
    expect(canConnect).toBe(false)
  })

  it('refuses a cable whose ends are not both in the patch', () => {
    // Arrange
    const nodes = createNodes([['pad', 'pad']])

    // Act
    const canConnect = canConnectStrudelFlowNodes('pad', 'missing-filter', nodes, [])

    // Assert
    expect(canConnect).toBe(false)
  })
})

describe('canUseStrudelFlowConnection', () => {
  it('applies the patch rules to a cable the player is drawing', () => {
    // Arrange
    const nodes = createNodes([
      ['beats', 'beats'],
      ['filter', 'filter']
    ])
    const validCable = { source: 'beats', target: 'filter' }
    const invalidCable = { source: 'filter', target: 'beats' }

    // Act
    const acceptsValidCable = canUseStrudelFlowConnection(validCable, nodes, [])
    const acceptsInvalidCable = canUseStrudelFlowConnection(invalidCable, nodes, [])

    // Assert
    expect(acceptsValidCable).toBe(true)
    expect(acceptsInvalidCable).toBe(false)
  })

  it('keeps an edge the graph already holds instead of rejecting it as a duplicate', () => {
    // Arrange
    const nodes = createNodes([
      ['pad', 'pad'],
      ['filter', 'filter']
    ])
    const edge = { id: 'pad-filter', source: 'pad', target: 'filter' }

    // Act
    const keepsEdge = canUseStrudelFlowConnection(edge, nodes, [edge])

    // Assert
    expect(keepsEdge).toBe(true)
  })
})
