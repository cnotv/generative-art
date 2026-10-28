import { describe, expect, it } from 'vitest'
import { compileStrudelFlow } from './compileStrudelFlow'
import { createDefaultStrudelFlowPatch } from './defaultPatch'
import { createStrudelFlowDrumRow, createStrudelFlowNodeData } from './nodeDefaults'
import { generateStrudelFlowNodePattern } from './nodePatterns'
import { appendStrudelFlowBlocks, parseStrudelFlowCode } from './parseStrudelFlowCode'
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
    ['visualizer', createStrudelFlowNodeData('visualizer')]
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

  it('round-trips a beat with any samples, a step count and variations', () => {
    // Arrange
    const beats = createNode('beats', {
      kind: 'beats',
      steps: 8,
      rows: [
        createStrudelFlowDrumRow('clubkick', [0, 4]),
        { ...createStrudelFlowDrumRow('cp', [2, 6]), modifiers: { 6: '!2' } },
        createStrudelFlowDrumRow('808oh', [1, 3, 5, 7])
      ],
      showModifiers: true
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
    ['note("c3 e3").s("sawtooth").lpf(800).fast(2)', ['notes', 'voice', 'filter']],
    ['s("bd*2 [~ sd]")', ['samples']],
    ['stack(note("c3"), s("hh*4")).room(.5)', ['notes', 'beats', 'space']],
    ['s("hh*8 [~ sd]")', ['samples']],
    ['s("bd(3,8)")', ['samples']],
    ['$: s("bd").struct("1 ~ ~ ~ 1 ~ ~ ~ 1 ~ ~ ~ 1 ~ ~ ~")', ['beats']],
    ['$: note("c3").lpf(slider(800, 200, 4000))', ['notes']],
    ['$: "c3 e3".note().jux(rev)', ['code']],
    ['$: stack(note("c3"), s("bd")).jux(rev)', ['notes', 'beats', 'effect']],
    ['$: note("c3")\n  // a comment between calls\n  .gain(.5)', ['notes', 'level']],
    ['$: note("c3")\n$: s("bd")', ['notes', 'beats']]
  ])('maps %s onto nodes', (code, kinds) => {
    // Arrange / Act
    const parsed = parseStrudelFlowCode(code)

    // Assert
    expect(parsed?.nodes.map((node) => node.data.kind)).toEqual(kinds)
  })

  it('keeps calls it has no dedicated control for on the node they chain after', () => {
    // Arrange
    const code = '$: note("c3").lpf(slider(800, 200, 4000)).sound("piano").fast(2).mask("<1 0>")'

    // Act
    const parsed = parseStrudelFlowCode(code)

    // Assert
    expect(parsed?.nodes.map((node) => node.data)).toEqual([
      {
        kind: 'notes',
        pattern: 'c3',
        calls: [{ method: 'lpf', argument: 'slider(800, 200, 4000)' }]
      },
      {
        kind: 'voice',
        sound: 'piano',
        calls: [
          { method: 'fast', argument: '2' },
          { method: 'mask', argument: '"<1 0>"' }
        ]
      }
    ])
    expect(compileStrudelFlow(parsed!).code).toBe(`setcpm(120/4)\n${code}`)
  })

  it.each([
    ['$: stack(note("c3"), s("bd")).jux(rev).swingBy(1/3, 4)', null],
    [
      '$: stack(note("c3").sometimesBy(.2, (x) => x.ply(2)), s("bd"))',
      '$: note("c3").sometimesBy(.2, (x) => x.ply(2))\n$: s("bd")'
    ],
    ['$: note("c3").mask("1 0").hush()', '_$: note("c3").mask("1 0")'],
    ['$: (note("c3").jux(rev)).mask("<1 1 1 0>")', '$: note("c3").jux(rev).mask("<1 1 1 0>")']
  ])('round-trips the calls in %s', (code, expectedCode) => {
    // Arrange / Act
    const parsed = parseStrudelFlowCode(code)

    // Assert
    expect(compileStrudelFlow(parsed!).code).toBe(`setcpm(120/4)\n${expectedCode ?? code}`)
  })

  it('collects calls after a stack with no single owner into one Effect node', () => {
    // Arrange
    const code = '$: stack(note("c3"), s("bd")).jux(rev).swingBy(1/3, 4)'

    // Act
    const parsed = parseStrudelFlowCode(code)

    // Assert
    expect(parsed?.nodes.at(-1)?.data).toEqual({
      kind: 'effect',
      calls: [
        { method: 'jux', argument: 'rev' },
        { method: 'swingBy', argument: '1/3, 4' }
      ]
    })
  })

  it('starts an Effect node for calls after a visual rather than putting them on it', () => {
    // Arrange
    const code = '$: note("c3")._punchcard().mask("<1 1 1 0>").swingBy(1/3, 4)'

    // Act
    const parsed = parseStrudelFlowCode(code)

    // Assert
    expect(parsed?.nodes.map((node) => node.data.kind)).toEqual(['notes', 'visualizer', 'effect'])
    expect(parsed?.nodes[1]?.data).not.toHaveProperty('calls')
    expect(compileStrudelFlow(parsed!).code).toBe(`setcpm(120/4)\n${code}`)
  })

  it('keeps stacked drum lines with calls of their own apart', () => {
    // Arrange
    const code = '$: stack(s("bd").mask("1 0"), s("hh"))'

    // Act
    const parsed = parseStrudelFlowCode(code)

    // Assert
    expect(parsed?.nodes.map((node) => node.data.kind)).toEqual(['beats', 'beats'])
    expect(parsed?.nodes[0]?.data.calls).toEqual([{ method: 'mask', argument: '"1 0"' }])
  })

  it('wires every stacked instrument into the shared effects in signal order', () => {
    // Arrange
    const code = '$: stack(note("c3"), s("bd*2 [~ sd]")).room(.5).gain(.8)'

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
    const code = '$: stack(note("c3").sound("sawtooth"), s("bd*2 [~ sd]")).room(0.5)'

    // Act
    const parsed = parseStrudelFlowCode(code)

    // Assert
    expect(parsed?.edges.map((edge) => `${edge.source}>${edge.target}`)).toEqual([
      'notes-1>voice-1',
      'voice-1>space-1',
      'samples-1>space-1'
    ])
    expect(compileStrudelFlow(parsed!).code).toContain(
      '$: stack(note("c3").sound("sawtooth"), s("bd*2 [~ sd]")).room(0.5)'
    )
  })

  it.each([
    ['s("~ cp ~ cp")', 4, [{ sound: 'cp', hits: [1, 3] }]],
    [
      's("bd [bd,cp] ~ cp:2*2")',
      4,
      [
        { sound: 'bd', hits: [0, 1] },
        { sound: 'cp', hits: [1] },
        { sound: 'cp:2', hits: [3] }
      ]
    ],
    [
      'stack(s("bd ~ ~ ~"), s("~ ~ cp ~"))',
      4,
      [
        { sound: 'bd', hits: [0] },
        { sound: 'cp', hits: [2] }
      ]
    ]
  ])('reads the sample line %s as Beats tracks', (code, steps, tracks) => {
    // Arrange / Act
    const parsed = parseStrudelFlowCode(`$: ${code}`)
    const beats = parsed?.nodes[0]?.data

    // Assert
    expect(parsed?.nodes).toHaveLength(1)
    expect(beats?.kind === 'beats' ? beats.steps : null).toBe(steps)
    expect(
      beats?.kind === 'beats'
        ? beats.rows.map((row) => ({
            sound: row.sound,
            hits: row.steps.flatMap((isHit, step) => (isHit ? [step] : []))
          }))
        : null
    ).toEqual(tracks)
  })

  it.each([
    ['._punchcard()', { visual: 'punchcard', placement: 'inline', options: '' }],
    [
      '._scope({ thickness: 2, scale: .5 })',
      {
        visual: 'scope',
        placement: 'inline',
        options: '{ thickness: 2, scale: .5 }'
      }
    ],
    [
      '.pianoroll({ labels: 1 })',
      { visual: 'pianoroll', placement: 'background', options: '{ labels: 1 }' }
    ],
    ['._spectrum()', { visual: 'spectrum', placement: 'inline', options: '' }]
  ])('reads %s as one Visualizer node', (call, visualizer) => {
    // Arrange
    const code = `$: note("c3 e3")${call}`

    // Act
    const parsed = parseStrudelFlowCode(code)

    // Assert
    expect(parsed?.nodes[1]?.data).toEqual({ kind: 'visualizer', ...visualizer })
    expect(compileStrudelFlow(parsed!).code).toBe(`setcpm(120/4)\n${code}`)
  })
})

describe('parseStrudelFlowCode with imported tabs', () => {
  it('reads every labelled note line as its own Notes node and voice', () => {
    // Arrange
    const code = [
      '// Read from 2 tabs: bass "low.png", guitar "chords.png"',
      'setcps(96/60/4)',
      '// bass "low.png": 2 bars',
      '$: note("<[a2@2 e3 ~] d3>").s("gm_electric_bass_finger")',
      '// guitar "chords.png": 1 bars',
      '$: note("[e4,g4]").s("gm_acoustic_guitar_nylon")'
    ].join('\n')

    // Act
    const parsed = parseStrudelFlowCode(code)
    const recompiled = compileStrudelFlow(parsed!)

    // Assert
    expect(parsed?.nodes.map((node) => node.data.kind)).toEqual([
      'notes',
      'voice',
      'notes',
      'voice'
    ])
    expect(parsed?.edges).toHaveLength(2)
    expect(parsed?.beatsPerMinute).toBe(96)
    expect(compileStrudelFlow(parseStrudelFlowCode(recompiled.code)!).code).toBe(recompiled.code)
  })
})

describe('appendStrudelFlowBlocks', () => {
  const blocks = '// guitar\n$: note("e4").s("gm_acoustic_guitar_nylon")'

  it.each([
    ['empty code', '', blocks],
    [
      'code that already plays labelled blocks',
      'setcps(1)\n$: s("bd")',
      `setcps(1)\n$: s("bd")\n\n${blocks}`
    ],
    [
      'a bare last expression, which Strudel would drop',
      'setcps(1)\n// bass\nnote("a2")\n  .s("bass") // low',
      `setcps(1)\n// bass\n$: note("a2")\n  .s("bass") // low\n\n${blocks}`
    ],
    ['code with no pattern', 'setcps(1)', `setcps(1)\n\n${blocks}`]
  ])('appends to %s', (_description, code, expected) => {
    // Arrange
    const appended = blocks

    // Act
    const result = appendStrudelFlowBlocks(code, appended)

    // Assert
    expect(result).toBe(expected)
  })
})
