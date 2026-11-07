import { describe, expect, it } from 'vitest'
import { compileStrudelFlow } from './compileStrudelFlow'
import { STRUDEL_FLOW_NODE_START_X, STRUDEL_FLOW_NODE_START_Y } from './config'
import { getStrudelFlowNodeSize } from './layout'
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
  it('keeps the notation picked on a Notes node when the code is read again', () => {
    // Arrange
    const nodes = [createNode('notes-1', { kind: 'notes', pattern: 'c3 e3', notation: 'piano' })]

    // Act
    const parsed = parseStrudelFlowCode('note("c3 g3")', nodes)

    // Assert
    expect(parsed?.nodes[0]?.data).toEqual({ kind: 'notes', pattern: 'c3 g3', notation: 'piano' })
  })

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

  it('drops a previous position that would sit on a node of the new layout', () => {
    // Arrange
    const previousNodes = [
      {
        ...createNode('samples-1', createStrudelFlowNodeData('samples')),
        position: { x: STRUDEL_FLOW_NODE_START_X, y: STRUDEL_FLOW_NODE_START_Y }
      }
    ]
    const song = `$: stack(
  s("bd*4").gain(.5).mask("<1!40 0!8 1!16>"),
  s("[~ hh]*4").gain(.35).mask("<0!4 1!60>")
).bank("RolandTR909")`

    // Act
    const parsed = parseStrudelFlowCode(song, previousNodes)

    // Assert
    const boxes = (parsed?.nodes ?? []).map((node) => ({
      id: node.id,
      ...node.position,
      ...getStrudelFlowNodeSize(node.data.kind)
    }))
    const overlapping = boxes.flatMap((left, index) =>
      boxes
        .slice(index + 1)
        .filter(
          (right) =>
            left.x < right.x + right.width &&
            right.x < left.x + left.width &&
            left.y < right.y + right.height &&
            right.y < left.y + left.height
        )
        .map((right) => `${left.id} on ${right.id}`)
    )
    expect(parsed?.nodes.map((node) => node.data.kind)).toContain('samples')
    expect(overlapping).toEqual([])
  })

  it.each([
    ['filter', createStrudelFlowNodeData('filter')],
    ['delay', createStrudelFlowNodeData('delay')],
    ['space', createStrudelFlowNodeData('space')],
    ['gain', createStrudelFlowNodeData('gain')],
    ['level', createStrudelFlowNodeData('level')],
    ['mask', createStrudelFlowNodeData('mask')],
    ['struct', createStrudelFlowNodeData('struct')],
    ['slow', createStrudelFlowNodeData('slow')],
    ['voicing', createStrudelFlowNodeData('voicing')],
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
    ['note("c3 e3").s("sawtooth").lpf(800).fast(2)', ['notes', 'voice', 'filter', 'effect']],
    ['s("bd*2 [~ sd]")', ['samples']],
    ['stack(note("c3"), s("hh*4")).room(.5)', ['notes', 'beats', 'space']],
    ['s("hh*8 [~ sd]")', ['samples']],
    ['s("bd(3,8)")', ['samples']],
    ['$: s("bd").struct("1 ~ ~ ~ 1 ~ ~ ~ 1 ~ ~ ~ 1 ~ ~ ~")', ['beats']],
    ['$: note("c3").lpf(slider(800, 200, 4000))', ['notes', 'effect']],
    ['$: "c3 e3".note().jux(rev)', ['code', 'effect', 'effect']],
    ['$: stack(note("c3"), s("bd")).jux(rev)', ['notes', 'beats', 'effect']],
    ['$: note("c3")\n  // a comment between calls\n  .gain(.5)', ['notes', 'gain']],
    ['$: note("c3")\n$: s("bd")', ['notes', 'beats']]
  ])('maps %s onto nodes', (code, kinds) => {
    // Arrange / Act
    const parsed = parseStrudelFlowCode(code)

    // Assert
    expect(parsed?.nodes.map((node) => node.data.kind)).toEqual(kinds)
  })

  it('reads struct, slow and voicing into nodes of their own', () => {
    // Arrange
    const code = '$: chord("<C Am>").voicing().struct("x ~ x x").slow(8).slow(slider(2, 1, 4))'

    // Act
    const parsed = parseStrudelFlowCode(code)

    // Assert
    expect(parsed?.nodes.map((node) => node.data)).toEqual([
      {
        kind: 'chords',
        key: 'C',
        octave: 4,
        scaleType: 'major',
        chordProgression: [0, 5],
        chordSymbols: true
      },
      { kind: 'voicing' },
      { kind: 'struct', argument: '"x ~ x x"' },
      { kind: 'slow', amount: 8 },
      { kind: 'effect', calls: [{ method: 'slow', argument: 'slider(2, 1, 4)' }] }
    ])
    expect(compileStrudelFlow(parsed!).code).toBe(`setcpm(120/4)\n${code}`)
  })

  it('keeps chord symbols that no key holds as a Notes node', () => {
    // Arrange
    const code = '$: chord("<Cm7 Fm7>").voicing()'

    // Act
    const parsed = parseStrudelFlowCode(code)

    // Assert
    expect(parsed?.nodes[0]?.data).toMatchObject({
      kind: 'notes',
      notation: 'names',
      head: 'chord'
    })
    expect(compileStrudelFlow(parsed!).code).toBe(`setcpm(120/4)\n${code}`)
  })

  it('gives each call it has no dedicated control for an Effect node of its own', () => {
    // Arrange
    const code = '$: note("c3").lpf(slider(800, 200, 4000)).sound("piano").fast(2).mask("<1 0>")'

    // Act
    const parsed = parseStrudelFlowCode(code)

    // Assert
    expect(parsed?.nodes.map((node) => node.data)).toEqual([
      { kind: 'notes', pattern: 'c3', notation: 'auto' },
      { kind: 'effect', calls: [{ method: 'lpf', argument: 'slider(800, 200, 4000)' }] },
      { kind: 'voice', sound: 'piano' },
      { kind: 'effect', calls: [{ method: 'fast', argument: '2' }] },
      { kind: 'mask', argument: '"<1 0>"' }
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

  it('gives each call after a stack an Effect node of its own', () => {
    // Arrange
    const code = '$: stack(note("c3"), s("bd")).jux(rev).swingBy(1/3, 4)'

    // Act
    const parsed = parseStrudelFlowCode(code)

    // Assert
    expect(parsed?.nodes.slice(-2).map((node) => node.data)).toEqual([
      { kind: 'effect', calls: [{ method: 'jux', argument: 'rev' }] },
      { kind: 'effect', calls: [{ method: 'swingBy', argument: '1/3, 4' }] }
    ])
  })

  it('starts an Effect node for calls after a visual rather than putting them on it', () => {
    // Arrange
    const code = '$: note("c3")._punchcard().jux(rev).swingBy(1/3, 4)'

    // Act
    const parsed = parseStrudelFlowCode(code)

    // Assert
    expect(parsed?.nodes.map((node) => node.data.kind)).toEqual([
      'notes',
      'visualizer',
      'effect',
      'effect'
    ])
    expect(parsed?.nodes[1]?.data).not.toHaveProperty('calls')
    expect(compileStrudelFlow(parsed!).code).toBe(`setcpm(120/4)\n${code}`)
  })

  it('keeps stacked drum lines with calls of their own apart', () => {
    // Arrange
    const code = '$: stack(s("bd").fast(2), s("hh"))'

    // Act
    const parsed = parseStrudelFlowCode(code)

    // Assert
    expect(parsed?.nodes.map((node) => node.data.kind)).toEqual(['beats', 'effect', 'beats'])
    expect(parsed?.nodes[1]?.data.calls).toEqual([{ method: 'fast', argument: '2' }])
  })

  it.each([
    [
      'a note line',
      'const riffs = "<c3 e3>"\n$: note(riffs).s("piano")',
      { kind: 'notes', pattern: '<c3 e3>', notation: 'auto' },
      '$: note("<c3 e3>").sound("piano")'
    ],
    [
      'a chord line',
      'const drone = arrange([2, silence], [1, "D5"])\n$: chord(drone).voicing()',
      { kind: 'notes', pattern: '<~!2 D5>', notation: 'names', head: 'chord' },
      '$: chord("<~!2 D5>").voicing()'
    ]
  ])(
    'reads %s that plays a constant as its node with the constant inlined',
    (_name, code, data, block) => {
      // Arrange / Act
      const parsed = parseStrudelFlowCode(code)

      // Assert
      expect(parsed?.nodes[0]?.data).toEqual(data)
      expect(compileStrudelFlow(parsed!).code).toContain(block)
    }
  )

  it('gives a sample line its own Gain and Mask nodes', () => {
    // Arrange
    const code = '$: s("bd*4").gain(.5).mask("<1!40 0!8>")'

    // Act
    const parsed = parseStrudelFlowCode(code)

    // Assert
    expect(parsed?.nodes.map((node) => node.data)).toEqual([
      expect.objectContaining({ kind: 'beats' }),
      { kind: 'gain', gain: 0.5 },
      { kind: 'mask', argument: '"<1!40 0!8>"' }
    ])
    expect(parsed?.edges.map((edge) => `${edge.source}>${edge.target}`)).toEqual([
      'beats-1>gain-1',
      'gain-1>mask-1'
    ])
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
      'space-1>gain-1'
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
      { kind: 'notes', pattern: 'c3 e3 g3', notation: 'auto' },
      { kind: 'gain', gain: 0.7 }
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
      notation: 'auto',
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

describe('parseStrudelFlowCode with imported instruments and visuals', () => {
  it('reads a pianoroll under each imported line as a visualizer on that branch', () => {
    // Arrange
    const code = [
      '// Read from 2 images: bass "low.png", piano score "river.png"',
      'setcps(96/60/4)',
      '// bass "low.png": 2 bars',
      '$: note("<[a2@2 e3 ~] d3>").s("gm_electric_bass_finger")',
      '  ._pianoroll()',
      '// right hand "river.png": 2 bars',
      '$: note("<a5 e5>").s("gm_piano")',
      '  ._pianoroll()'
    ].join('\n')

    // Act
    const parsed = parseStrudelFlowCode(code)
    const recompiled = compileStrudelFlow(parsed!)

    // Assert
    expect(parsed?.nodes.map((node) => node.data.kind)).toEqual([
      'notes',
      'voice',
      'visualizer',
      'notes',
      'voice',
      'visualizer'
    ])
    expect(parsed?.edges).toHaveLength(4)
    expect(recompiled.code.match(/_pianoroll\(\)/g)).toHaveLength(2)
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
