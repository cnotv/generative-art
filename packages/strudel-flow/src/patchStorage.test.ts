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
    expect(patch?.beatsPerMinute).toBe(90)
    expect(patch?.edges).toEqual([{ id: 'pad-filter', source: 'pad', target: 'filter' }])
    expect(patch?.nodes[0]?.position).toEqual({ x: 10, y: 20 })
    expect(patch?.nodes[0]?.data).toMatchObject({
      kind: 'pad',
      steps: 8,
      mode: 'arp',
      octave: 3,
      key: 'C',
      scaleType: 'major'
    })
    expect(patch?.nodes[1]?.data).toEqual({ kind: 'filter', cutoff: 800, resonance: 4 })
  })

  it('keeps an empty patch rather than bringing the starter patch back', () => {
    // Arrange
    const storedValue = storePatch({ nodes: [], edges: [], beatsPerMinute: 120 })

    // Act
    const patch = parseStrudelFlowPatch(storedValue)

    // Assert
    expect(patch).toEqual({
      nodes: [],
      edges: [],
      beatsPerMinute: 120,
      beatsPerCycle: 4,
      setup: ''
    })
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
    expect(patch?.nodes[0]?.data).toMatchObject({
      kind: 'pad',
      steps: 8,
      mode: 'arp',
      octave: 3,
      key: 'C',
      scaleType: 'major'
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

  it('reads a pad grid, modifiers and chord settings', () => {
    // Arrange
    const grid = Array.from({ length: 16 }, () => Array<boolean>(8).fill(false))
    grid[0][3] = true
    grid[1][0] = true
    const storedValue = storePatch({
      nodes: [
        {
          id: 'pad',
          position: { x: 0, y: 0 },
          data: {
            kind: 'pad',
            steps: 2,
            mode: 'chord',
            octave: 4,
            key: 'D',
            scaleType: 'minor',
            grid,
            columnModifiers: { 0: '*2', 1: 'sausage', 2: '/3' }
          }
        },
        {
          id: 'chords',
          position: { x: 0, y: 300 },
          data: {
            kind: 'chords',
            key: 'A',
            octave: 5,
            scaleType: 'minor',
            chordProgression: [0, 4],
            chordNotes: [
              [7, 3, 0],
              [9, 5, 4]
            ]
          }
        }
      ]
    })

    // Act
    const patch = parseStrudelFlowPatch(storedValue)

    // Assert
    const padData = patch!.nodes[0]!.data as { grid: boolean[][] }
    expect(padData).toMatchObject({
      kind: 'pad',
      steps: 2,
      mode: 'chord',
      octave: 4,
      key: 'D',
      scaleType: 'minor',
      columnModifiers: { 0: '*2', 2: '/3' }
    })
    expect(padData.grid[0]?.[3]).toBe(true)
    expect(padData.grid[1]?.[0]).toBe(true)
    expect(patch!.nodes[1]!.data).toEqual({
      kind: 'chords',
      key: 'A',
      octave: 5,
      scaleType: 'minor',
      chordProgression: [0, 4],
      chordNotes: [
        [0, 3, 7],
        [4, 5, 9]
      ]
    })
  })

  it('clamps pad and chord controls and drops malformed progression data', () => {
    // Arrange
    const storedValue = storePatch({
      nodes: [
        {
          id: 'pad',
          position: { x: 0, y: 0 },
          data: { kind: 'pad', steps: 0, octave: 99, key: 'H', scaleType: 'nope' }
        },
        {
          id: 'chords',
          position: { x: 0, y: 300 },
          data: {
            kind: 'chords',
            octave: 0,
            chordProgression: [9, -1],
            chordNotes: [[1, 2], [99]],
            key: 'Z'
          }
        }
      ]
    })

    // Act
    const patch = parseStrudelFlowPatch(storedValue)

    // Assert
    expect(patch?.nodes[0]?.data).toMatchObject({
      kind: 'pad',
      steps: 1,
      octave: 8,
      key: 'C',
      scaleType: 'major'
    })
    expect(patch?.nodes[1]?.data).toMatchObject({
      kind: 'chords',
      key: 'C',
      octave: 1,
      scaleType: 'major',
      chordProgression: [0, 5, 3, 4]
    })
    expect(patch?.nodes[1]?.data).not.toHaveProperty('chordNotes')
  })

  it('reads the level, envelope, visualizer and expanded space effects', () => {
    // Arrange
    const storedValue = storePatch({
      nodes: [
        {
          id: 'space',
          position: { x: 0, y: 0 },
          data: {
            kind: 'space',
            room: 2,
            roomSize: 99,
            roomFade: 4,
            roomLowPass: 5000,
            roomDim: 3000
          }
        },
        {
          id: 'level',
          position: { x: 0, y: 100 },
          data: { kind: 'level', gain: 5, pan: -1, postgain: 0.5 }
        },
        {
          id: 'envelope',
          position: { x: 0, y: 200 },
          data: { kind: 'envelope', attack: -2, decay: 0.5, sustain: 2, release: 1.5 }
        },
        {
          id: 'visualizer',
          position: { x: 0, y: 300 },
          data: { kind: 'visualizer', visual: 'kaleidoscope', placement: 'background', options: 7 }
        }
      ]
    })

    // Act
    const patch = parseStrudelFlowPatch(storedValue)

    // Assert
    expect(patch?.nodes[0]?.data).toEqual({
      kind: 'space',
      room: 1,
      roomSize: 20,
      roomFade: 4,
      roomLowPass: 5000,
      roomDim: 3000
    })
    expect(patch?.nodes[1]?.data).toEqual({
      kind: 'level',
      gain: 2,
      pan: 0,
      postgain: 0.5
    })
    expect(patch?.nodes[2]?.data).toEqual({
      kind: 'envelope',
      attack: 0,
      decay: 0.5,
      sustain: 1,
      release: 1.5
    })
    expect(patch?.nodes[3]?.data).toEqual({
      kind: 'visualizer',
      visual: 'pianoroll',
      placement: 'background',
      options: ''
    })
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

  it('reads the calls chained onto a node and an Effect node stored with one call', () => {
    // Arrange
    const storedValue = storePatch({
      nodes: [
        {
          id: 'notes',
          position: { x: 0, y: 0 },
          data: {
            kind: 'notes',
            pattern: 'c3',
            calls: [{ method: 'mask', argument: '"1 0"' }, { method: 7 }, 'fast']
          }
        },
        {
          id: 'effect',
          position: { x: 300, y: 0 },
          data: { kind: 'effect', method: 'jux', argument: 'rev' }
        }
      ]
    })

    // Act
    const patch = parseStrudelFlowPatch(storedValue)

    // Assert
    expect(patch?.nodes[0]?.data).toEqual({
      kind: 'notes',
      pattern: 'c3',
      calls: [{ method: 'mask', argument: '"1 0"' }]
    })
    expect(patch?.nodes[1]?.data).toEqual({
      kind: 'effect',
      calls: [{ method: 'jux', argument: 'rev' }]
    })
  })
})
