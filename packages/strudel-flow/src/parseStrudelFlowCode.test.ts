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
  const original = compileStrudelFlow({
    nodes,
    edges,
    beatsPerMinute: 120,
    beatsPerCycle: 4,
    setup: ''
  })
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
    expect(parsed?.nodes.map((node) => node.data.kind)).toEqual(['pad', 'voice', 'filter'])
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
      chordProgression: [0, 5, 3, 4]
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
      columnModifiers: { 0: '*2', 1: '!3' }
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
      columnModifiers: { 0: '*2', 1: '!3' }
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
      code: 'n(run(8))'
    })

    // Act
    const { original, parsed } = roundTrip([code])

    // Assert
    expect(parsed?.nodes.map((node) => node.data.kind)).toEqual(['code'])
    expect(compileStrudelFlow(parsed!)).toEqual(original)
  })

  it.each([
    ['setcpm(90/4)', 90, 4],
    ['setcpm(90/3)', 90, 3],
    ['setcpm(30)', 120, 4],
    ['setcps(0.5)', 120, 4],
    ['setcps(140/60/4)', 140, 4]
  ])('reads the tempo from %s', (tempoLine, beatsPerMinute, beatsPerCycle) => {
    // Arrange
    const code = [
      tempoLine,
      `$: ${generateStrudelFlowNodePattern(createStrudelFlowNodeData('pad'), '')}`
    ].join('\n')

    // Act
    const parsed = parseStrudelFlowCode(code)

    // Assert
    expect(parsed?.beatsPerMinute).toBe(beatsPerMinute)
    expect(parsed?.beatsPerCycle).toBe(beatsPerCycle)
    expect(parsed?.setup).toBe('')
  })

  it('keeps every block as its own graph branch', () => {
    // Arrange
    const pad = createNode('pad', createStrudelFlowNodeData('pad'))
    const chords = createNode('chords', createStrudelFlowNodeData('chords'))
    const compilation = compileStrudelFlow({
      nodes: [pad, chords],
      edges: [],
      beatsPerMinute: 120,
      beatsPerCycle: 4,
      setup: ''
    })

    // Act
    const parsed = parseStrudelFlowCode(compilation.code)

    // Assert
    expect(parsed?.nodes.map((node) => node.data.kind)).toEqual(['pad', 'chords'])
    expect(new Set(parsed?.nodes.map((node) => node.id)).size).toBe(parsed?.nodes.length)
    expect(compileStrudelFlow(parsed!)).toEqual(compilation)
  })

  it('returns an empty patch for empty code and null for a syntax error', () => {
    // Arrange
    const emptyPrograms = ['', 'setcpm(120/4)', '   \n  ', '// only a comment']

    // Act
    const parsedEmpty = emptyPrograms.map((code) => parseStrudelFlowCode(code))
    const parsedBroken = parseStrudelFlowCode('$: note("c3"')

    // Assert
    parsedEmpty.forEach((patch) => expect(patch?.nodes).toEqual([]))
    expect(parsedBroken).toBeNull()
  })

  it.each([
    ['note("c3 e3").s("sawtooth").lpf(800).fast(2)', ['notes', 'voice', 'filter', 'effect']],
    ['s("bd*2 [~ sd]")', ['samples']],
    ['stack(note("c3"), s("hh*4")).room(.5)', ['notes', 'samples', 'space']],
    ['$: s("bd").struct("1 ~ ~ ~ 1 ~ ~ ~ 1 ~ ~ ~ 1 ~ ~ ~")', ['beats']],
    ['$: note("c3").lpf(slider(800, 200, 4000))', ['notes', 'effect']],
    ['$: "c3 e3".note().jux(rev)', ['code', 'effect', 'effect']],
    ['$: note("c3")\n  // a comment between calls\n  .gain(.5)', ['notes', 'level']],
    ['$: note("c3")\n$: s("bd")', ['notes', 'samples']]
  ])('maps %s onto nodes', (code, kinds) => {
    // Arrange / Act
    const parsed = parseStrudelFlowCode(code)

    // Assert
    expect(parsed?.nodes.map((node) => node.data.kind)).toEqual(kinds)
  })

  it('keeps the arguments of calls it has no dedicated control for', () => {
    // Arrange
    const code = '$: note("c3").lpf(slider(800, 200, 4000)).sound("piano").fast(2)'

    // Act
    const parsed = parseStrudelFlowCode(code)

    // Assert
    expect(parsed?.nodes.map((node) => node.data)).toEqual([
      { kind: 'notes', pattern: 'c3' },
      { kind: 'effect', method: 'lpf', argument: 'slider(800, 200, 4000)' },
      { kind: 'voice', sound: 'piano' },
      { kind: 'effect', method: 'fast', argument: '2' }
    ])
    expect(compileStrudelFlow(parsed!).code).toBe(`setcpm(120/4)\n${code}`)
  })

  it('wires every stacked instrument into the shared effects in signal order', () => {
    // Arrange
    const code = '$: stack(note("c3"), s("hh*4")).room(.5).gain(.8)'

    // Act
    const parsed = parseStrudelFlowCode(code)

    // Assert
    expect(parsed?.edges.map((edge) => `${edge.source}>${edge.target}`)).toEqual([
      'notes-1>space-1',
      'samples-1>space-1',
      'space-1>level-1'
    ])
  })

  it('keeps setup statements and plays the last expression when there is no block', () => {
    // Arrange
    const code = [
      "samples('github:tidalcycles/dirt-samples')",
      'const melody = "c3 e3 g3"',
      'note(melody).gain(.7)'
    ].join('\n')

    // Act
    const parsed = parseStrudelFlowCode(code)

    // Assert
    expect(parsed?.setup).toBe(
      'samples(\'github:tidalcycles/dirt-samples\')\nconst melody = "c3 e3 g3"'
    )
    expect(parsed?.nodes.map((node) => node.data)).toEqual([
      { kind: 'code', code: 'note(melody)' },
      { kind: 'level', gain: 0.7, pan: 0.5, postgain: 1 }
    ])
  })

  it.each([
    ['_$: note("c3")', true],
    ['$: note("c3").hush()', true],
    ['$: note("c3")', false]
  ])('reads %s as muted: %s', (code, muted) => {
    // Arrange / Act
    const parsed = parseStrudelFlowCode(code)

    // Assert
    expect(parsed?.nodes[0]?.data).toEqual({
      kind: 'notes',
      pattern: 'c3',
      ...(muted ? { muted: true } : {})
    })
  })

  it('settles on stable code for a stacked branch with its own effects', () => {
    // Arrange
    const code = '$: stack(note("c3").lpf(200), s("bd"))'
    const rewrite = (source: string): string =>
      compileStrudelFlow(parseStrudelFlowCode(source)!).code

    // Act
    const once = rewrite(code)
    const twice = rewrite(once)
    const thrice = rewrite(twice)

    // Assert
    expect(thrice).toBe(twice)
    expect(thrice).not.toContain('((')
    expect(thrice).toContain('lpf(200)')
  })

  it('reads a stacked branch with its own effects back onto that branch alone', () => {
    // Arrange
    const code = '$: stack(note("c3").sound("sawtooth"), s("bd")).room(0.5)'

    // Act
    const parsed = parseStrudelFlowCode(code)

    // Assert
    expect(parsed?.edges.map((edge) => `${edge.source}>${edge.target}`)).toEqual([
      'notes-1>voice-1',
      'voice-1>space-1',
      'samples-1>space-1'
    ])
    expect(compileStrudelFlow(parsed!).code).toContain(
      '$: stack(note("c3").sound("sawtooth"), s("bd")).room(0.5)'
    )
  })
})
