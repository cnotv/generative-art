import { describe, expect, it } from 'vitest'
import { parseStrudelFlowPatch } from './patchStorage'

const storePatch = (value: unknown): string => JSON.stringify(value)

describe('parseStrudelFlowPatch', () => {
  it('returns null when nothing is stored', () => {
    // Arrange
    const storedValue = null

    // Act
    const patch = parseStrudelFlowPatch(storedValue)

    // Assert
    expect(patch).toBeNull()
  })

  it.each([
    ['broken JSON', '{'],
    ['a value that is not a patch', '[]'],
    ['a patch without nodes', '{"edges":[]}']
  ])('returns null for %s', (_case, storedValue) => {
    // Arrange / Act
    const patch = parseStrudelFlowPatch(storedValue)

    // Assert
    expect(patch).toBeNull()
  })

  it('reads a patch with its nodes, cable and tempo', () => {
    // Arrange
    const storedValue = storePatch({
      nodes: [
        {
          id: 'pad',
          type: 'strudel',
          position: { x: 10, y: 20 },
          data: { kind: 'pad', notes: 'c3 e3', sound: 'sine' }
        },
        {
          id: 'filter',
          type: 'strudel',
          position: { x: 300, y: 20 },
          data: { kind: 'filter', cutoff: 800, resonance: 4 }
        }
      ],
      edges: [{ id: 'pad-filter', source: 'pad', target: 'filter' }],
      beatsPerMinute: 90
    })

    // Act
    const patch = parseStrudelFlowPatch(storedValue)

    // Assert
    expect(patch).toEqual({
      nodes: [
        {
          id: 'pad',
          type: 'strudel',
          position: { x: 10, y: 20 },
          data: { kind: 'pad', notes: 'c3 e3', sound: 'sine' }
        },
        {
          id: 'filter',
          type: 'strudel',
          position: { x: 300, y: 20 },
          data: { kind: 'filter', cutoff: 800, resonance: 4 }
        }
      ],
      edges: [{ id: 'pad-filter', source: 'pad', target: 'filter' }],
      beatsPerMinute: 90
    })
  })

  it('keeps an empty patch rather than bringing the starter patch back', () => {
    // Arrange
    const storedValue = storePatch({ nodes: [], edges: [], beatsPerMinute: 120 })

    // Act
    const patch = parseStrudelFlowPatch(storedValue)

    // Assert
    expect(patch).toEqual({ nodes: [], edges: [], beatsPerMinute: 120 })
  })

  it.each([
    [999, 300],
    [0, 1],
    ['120', 120],
    [null, 120]
  ])('keeps a stored tempo of %s inside the control as %s', (beatsPerMinute, expectedTempo) => {
    // Arrange
    const storedValue = storePatch({ nodes: [], edges: [], beatsPerMinute })

    // Act
    const patch = parseStrudelFlowPatch(storedValue)

    // Assert
    expect(patch?.beatsPerMinute).toBe(expectedTempo)
  })

  it('drops nodes without an id or with an unknown kind, and the second of two equal ids', () => {
    // Arrange
    const storedValue = storePatch({
      nodes: [
        { id: '', position: { x: 0, y: 0 }, data: { kind: 'pad' } },
        { id: 'mystery', position: { x: 0, y: 0 }, data: { kind: 'oscillator' } },
        { id: 'pad', position: { x: 0, y: 0 }, data: { kind: 'pad' } },
        { id: 'pad', position: { x: 50, y: 50 }, data: { kind: 'beats' } }
      ]
    })

    // Act
    const patch = parseStrudelFlowPatch(storedValue)

    // Assert
    expect(patch?.nodes.map((node) => [node.id, node.data.kind])).toEqual([['pad', 'pad']])
  })

  it('replaces malformed node settings with defaults and clamps the ranges', () => {
    // Arrange
    const storedValue = storePatch({
      nodes: [
        {
          id: 'pad',
          position: { x: 0, y: 0 },
          data: { kind: 'pad', notes: 42, sound: 'tuba' }
        },
        {
          id: 'filter',
          position: { x: 0, y: 0 },
          data: { kind: 'filter', cutoff: 999999, resonance: 0 }
        }
      ]
    })

    // Act
    const patch = parseStrudelFlowPatch(storedValue)

    // Assert
    expect(patch?.nodes[0]?.data).toEqual({
      kind: 'pad',
      notes: '<c3 eb3 g3 bb3>',
      sound: 'triangle'
    })
    expect(patch?.nodes[1]?.data).toEqual({ kind: 'filter', cutoff: 20000, resonance: 0.1 })
  })

  it('drops self, missing, duplicate, instrument and loop cables but keeps the rest', () => {
    // Arrange
    const storedValue = storePatch({
      nodes: [
        { id: 'pad', position: { x: 0, y: 0 }, data: { kind: 'pad' } },
        { id: 'beats', position: { x: 0, y: 100 }, data: { kind: 'beats' } },
        { id: 'filter', position: { x: 300, y: 0 }, data: { kind: 'filter' } },
        { id: 'delay', position: { x: 600, y: 0 }, data: { kind: 'delay' } }
      ],
      edges: [
        { id: 'self', source: 'pad', target: 'pad' },
        { id: 'missing', source: 'pad', target: 'missing' },
        { id: 'into-instrument', source: 'filter', target: 'beats' },
        { id: 'pad-filter', source: 'pad', target: 'filter' },
        { id: 'duplicate', source: 'pad', target: 'filter' },
        { id: 'filter-delay', source: 'filter', target: 'delay' },
        { id: 'loop', source: 'delay', target: 'filter' }
      ]
    })

    // Act
    const patch = parseStrudelFlowPatch(storedValue)

    // Assert
    expect(patch?.edges.map((edge) => `${edge.source}-${edge.target}`)).toEqual([
      'pad-filter',
      'filter-delay'
    ])
  })

  it('gives a cable a usable id when its stored one is missing or already taken', () => {
    // Arrange
    const storedValue = storePatch({
      nodes: [
        { id: 'pad', position: { x: 0, y: 0 }, data: { kind: 'pad' } },
        { id: 'beats', position: { x: 0, y: 100 }, data: { kind: 'beats' } },
        { id: 'filter', position: { x: 300, y: 0 }, data: { kind: 'filter' } }
      ],
      edges: [
        { id: 'same', source: 'pad', target: 'filter' },
        { id: 'same', source: 'beats', target: 'filter' }
      ]
    })

    // Act
    const patch = parseStrudelFlowPatch(storedValue)

    // Assert
    expect(patch?.edges.map((edge) => edge.id)).toEqual(['same', 'beats-filter'])
  })
})
