import { describe, expect, it } from 'vitest'
import { compileStrudelFlow } from './compileStrudelFlow'
import { createDefaultStrudelFlowPatch } from './defaultPatch'
import { createStrudelFlowNodeData } from './nodeDefaults'
import { generateStrudelFlowNodePattern } from './nodePatterns'
import { parseStrudelFlowCode } from './parseStrudelFlowCode'
import type { StrudelFlowEdge, StrudelFlowNode, StrudelFlowNodeData } from './types'

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

const roundTrip = (nodes: StrudelFlowNode[], edges: StrudelFlowEdge[] = []) => {
  const original = compileStrudelFlow({ nodes, edges, beatsPerMinute: 120 })
  const parsed = parseStrudelFlowCode(original.code, nodes)
  return { original, parsed }
}

describe('parseStrudelFlowCode', () => {
  it('round-trips the starter patch and reuses its node positions', () => {
    // Arrange
    const patch = createDefaultStrudelFlowPatch()

    // Act
    const { original, parsed } = roundTrip(patch.nodes, patch.edges)

    // Assert
    expect(parsed).not.toBeNull()
    expect(parsed?.nodes.map((node) => node.data.kind)).toEqual(['pad', 'filter'])
    expect(parsed?.nodes.map((node) => node.position)).toEqual(
      patch.nodes.map((node) => node.position)
    )
    expect(compileStrudelFlow(parsed!)).toEqual(original)
  })

  it.each([
    ['filter', createStrudelFlowNodeData('filter')],
    ['delay', createStrudelFlowNodeData('delay')],
    ['space', createStrudelFlowNodeData('space')],
    ['level', createStrudelFlowNodeData('level')],
    ['envelope', createStrudelFlowNodeData('envelope')],
    ['scope', createStrudelFlowNodeData('scope')]
  ])('round-trips a pad through a %s effect', (kind, effect) => {
    // Arrange
    const pad = createNode('pad', createStrudelFlowNodeData('pad'))
    const effectNode = createNode(kind, effect)

    // Act
    const { original, parsed } = roundTrip([pad, effectNode], [createEdge('pad', kind)])

    // Assert
    expect(parsed?.nodes.map((node) => node.data.kind)).toEqual(['pad', kind])
    expect(compileStrudelFlow(parsed!)).toEqual(original)
  })

  it('round-trips the default chord progression without marking it as hand-edited', () => {
    // Arrange
    const chords = createNode('chords', createStrudelFlowNodeData('chords'))

    // Act
    const { original, parsed } = roundTrip([chords])

    // Assert
    const parsedChords = parsed?.nodes.find((node) => node.data.kind === 'chords')
    expect(parsedChords?.data).toMatchObject({
      kind: 'chords',
      key: 'C',
      octave: 4,
      scaleType: 'major',
      chordProgression: [0, 5, 3, 4],
      sound: 'sawtooth'
    })
    expect(parsedChords?.data).not.toHaveProperty('chordNotes')
    expect(compileStrudelFlow(parsed!)).toEqual(original)
  })

  it('round-trips hand-edited chord tones', () => {
    // Arrange
    const chords = createNode('chords', {
      kind: 'chords',
      key: 'C',
      octave: 4,
      scaleType: 'major',
      chordProgression: [0, 4],
      chordNotes: [
        [0, 3, 7],
        [4, 5, 9]
      ],
      sound: 'sine'
    })

    // Act
    const { original, parsed } = roundTrip([chords])

    // Assert
    expect(parsed?.nodes[0]?.data).toMatchObject({
      kind: 'chords',
      chordNotes: [
        [0, 3, 7],
        [4, 5, 9]
      ]
    })
    expect(compileStrudelFlow(parsed!)).toEqual(original)
  })

  it('round-trips a pad with chord mode, modifiers and another scale', () => {
    // Arrange
    const grid = Array.from({ length: 16 }, () => Array<boolean>(8).fill(false))
    grid[0][0] = true
    grid[0][2] = true
    grid[1][4] = true
    const pad = createNode('pad', {
      kind: 'pad',
      steps: 2,
      mode: 'chord',
      octave: 4,
      key: 'D',
      scaleType: 'minor',
      grid,
      columnModifiers: { 0: '*2', 1: '!3' },
      sound: 'sine'
    })

    // Act
    const { original, parsed } = roundTrip([pad])

    // Assert
    const data = parsed!.nodes[0]!.data as { grid: boolean[][] }
    expect(data).toMatchObject({
      kind: 'pad',
      steps: 2,
      mode: 'chord',
      octave: 4,
      key: 'D',
      scaleType: 'minor',
      columnModifiers: { 0: '*2', 1: '!3' },
      sound: 'sine'
    })
    expect(data.grid[0]?.[0]).toBe(true)
    expect(data.grid[0]?.[2]).toBe(true)
    expect(data.grid[1]?.[4]).toBe(true)
    expect(compileStrudelFlow(parsed!)).toEqual(original)
  })

  it('round-trips a two-row beat as a stack', () => {
    // Arrange
    const beats = createNode('beats', {
      kind: 'beats',
      rows: [
        { instrument: 'bd', steps: [true, ...Array<boolean>(15).fill(false)] },
        { instrument: 'sd', steps: [false, ...Array<boolean>(15).fill(true)] }
      ]
    })

    // Act
    const { original, parsed } = roundTrip([beats])

    // Assert
    expect(parsed?.nodes[0]?.data).toEqual(beats.data)
    expect(compileStrudelFlow(parsed!)).toEqual(original)
  })

  it('round-trips a custom expression as a Code node', () => {
    // Arrange
    const code = createNode('code', {
      kind: 'code',
      code: 'n("0 2 4").scale("C3:major")\n  .sound("triangle")'
    })

    // Act
    const { original, parsed } = roundTrip([code])

    // Assert
    expect(parsed?.nodes.map((node) => node.data.kind)).toEqual(['code'])
    expect(compileStrudelFlow(parsed!)).toEqual(original)
  })

  it.each([
    ['setcpm(90/4)', 90],
    ['setcpm(120/4)', 120],
    ['setcpm(30)', 120]
  ])('reads the tempo from %s', (tempoLine, beatsPerMinute) => {
    // Arrange
    const code = [
      tempoLine,
      `$: ${generateStrudelFlowNodePattern(createStrudelFlowNodeData('pad'), '')}`
    ].join('\n')

    // Act
    const parsed = parseStrudelFlowCode(code)

    // Assert
    expect(parsed?.beatsPerMinute).toBe(beatsPerMinute)
  })

  it('keeps every block as its own graph branch', () => {
    // Arrange
    const pad = createNode('pad', createStrudelFlowNodeData('pad'))
    const chords = createNode('chords', createStrudelFlowNodeData('chords'))
    const compilation = compileStrudelFlow({ nodes: [pad, chords], edges: [], beatsPerMinute: 120 })

    // Act
    const parsed = parseStrudelFlowCode(compilation.code)

    // Assert
    expect(parsed?.nodes.map((node) => node.data.kind)).toEqual(['pad', 'chords'])
    expect(new Set(parsed?.nodes.map((node) => node.id)).size).toBe(parsed?.nodes.length)
    expect(compileStrudelFlow(parsed!)).toEqual(compilation)
  })

  it('returns null when there is no code to parse', () => {
    // Arrange / Act / Assert
    expect(parseStrudelFlowCode('')).toBeNull()
    expect(parseStrudelFlowCode('setcpm(120/4)')).toBeNull()
    expect(parseStrudelFlowCode('   \n  ')).toBeNull()
  })
})
