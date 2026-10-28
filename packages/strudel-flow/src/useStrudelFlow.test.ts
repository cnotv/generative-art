import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { effectScope, nextTick } from 'vue'
import type { EffectScope } from 'vue'
import { STRUDEL_FLOW_PATCH_STORAGE_KEY } from './config'
import { compileStrudelFlow } from './compileStrudelFlow'
import { parseStrudelFlowPatch } from './patchStorage'
import { useStrudelFlow } from './useStrudelFlow'
import type { StrudelFlowState } from './types'

const scopes: EffectScope[] = []

const createFlow = (): StrudelFlowState => {
  const scope = effectScope()
  const flow = scope.run(() => useStrudelFlow())
  if (flow === undefined) {
    throw new Error('The flow scope did not create its state')
  }
  scopes.push(scope)
  return flow
}

const STARTER_IDS = ['pad-starter', 'voice-starter', 'filter-starter']

const readStoredPatch = (): ReturnType<typeof parseStrudelFlowPatch> =>
  parseStrudelFlowPatch(localStorage.getItem(STRUDEL_FLOW_PATCH_STORAGE_KEY))

describe('useStrudelFlow', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    scopes.splice(0).forEach((scope) => scope.stop())
  })

  it('starts from the pad, voice and filter starter patch', () => {
    // Arrange / Act
    const flow = createFlow()

    // Assert
    expect(flow.nodes.value.map((node) => node.id)).toEqual(STARTER_IDS)
    expect(flow.edges.value).toHaveLength(2)
    expect(flow.beatsPerMinute.value).toBe(120)
    expect(flow.compilation.value.code).toContain('setcpm(120/4)')
    expect(flow.compilation.value.errorMessage).toBeNull()
  })

  it('opens the patch saved on the last visit', () => {
    // Arrange
    localStorage.setItem(
      STRUDEL_FLOW_PATCH_STORAGE_KEY,
      JSON.stringify({
        nodes: [
          {
            id: 'chords-1',
            type: 'strudel',
            position: { x: 20, y: 30 },
            data: {
              kind: 'chords',
              key: 'A',
              octave: 4,
              scaleType: 'minor',
              chordProgression: [0, 5, 3, 4]
            }
          }
        ],
        edges: [],
        beatsPerMinute: 96
      })
    )

    // Act
    const flow = createFlow()

    // Assert
    expect(flow.nodes.value.map((node) => node.id)).toEqual(['chords-1'])
    expect(flow.beatsPerMinute.value).toBe(96)
    expect(flow.compilation.value.code).toContain(
      'n("<[0,2,4] [5,7,9] [3,5,7] [4,6,8]>").scale("A4:minor")'
    )
  })

  it('adds nodes with fresh settings and a unique id', () => {
    // Arrange
    const flow = createFlow()

    // Act
    flow.addNode('beats')
    flow.addNode('beats')
    flow.addNode('pad')

    // Assert
    expect(flow.nodes.value.map((node) => node.id)).toEqual([
      ...STARTER_IDS,
      'beats-1',
      'beats-2',
      'pad-1'
    ])
    const firstBeats = flow.nodes.value.find((node) => node.id === 'beats-1')
    const secondBeats = flow.nodes.value.find((node) => node.id === 'beats-2')
    expect(firstBeats?.data).not.toBe(secondBeats?.data)
    expect(
      new Set(flow.nodes.value.map((node) => `${node.position.x}-${node.position.y}`)).size
    ).toBe(flow.nodes.value.length)
  })

  it('updates a node and compiles its new settings', () => {
    // Arrange
    const flow = createFlow()
    const grid = Array.from({ length: 16 }, () => Array<boolean>(8).fill(false))
    grid[0][0] = true
    grid[0][2] = true

    // Act
    flow.updateNodeData('pad-starter', {
      kind: 'pad',
      steps: 1,
      mode: 'arp',
      octave: 4,
      key: 'G',
      scaleType: 'major',
      grid,
      columnModifiers: {}
    })

    // Assert
    expect(flow.compilation.value.code).toContain('n("[0 2]").scale("G4:major").sound("triangle")')
  })

  it('rebuilds the graph from code and keeps the node positions', () => {
    // Arrange
    const flow = createFlow()
    const compiledCode = flow.compilation.value.code
    const firstPosition = flow.nodes.value[0]?.position

    // Act
    flow.loadCode(compiledCode)

    // Assert
    expect(flow.nodes.value.map((node) => node.data.kind)).toEqual(['pad', 'voice', 'filter'])
    expect(flow.nodes.value[0]?.position).toEqual(firstPosition)
    expect(flow.compilation.value.code).toBe(compiledCode)
  })

  it('keeps an unrecognized pattern head as a Code node with its calls', () => {
    // Arrange
    const flow = createFlow()
    const source = ['setcpm(120/4)', '$: n(run(8)).fast(2)'].join('\n')

    // Act
    flow.loadCode(source)

    // Assert
    expect(flow.nodes.value.map((node) => node.data.kind)).toEqual(['code'])
    expect(flow.compilation.value.code).toBe('setcpm(120/4)\n$: (n(run(8))).fast(2)')
  })

  it('empties the graph for empty code and keeps it while the code has a syntax error', () => {
    // Arrange
    const flow = createFlow()
    const nodeIds = flow.nodes.value.map((node) => node.id)

    // Act
    const loadedBrokenCode = flow.loadCode('$: note("c3"')
    const nodeIdsAfterBrokenCode = flow.nodes.value.map((node) => node.id)
    const loadedEmptyCode = flow.loadCode('   ')

    // Assert
    expect(loadedBrokenCode).toBe(false)
    expect(nodeIdsAfterBrokenCode).toEqual(nodeIds)
    expect(loadedEmptyCode).toBe(true)
    expect(flow.nodes.value).toEqual([])
  })

  it('connects a new instrument to the starter filter once', () => {
    // Arrange
    const flow = createFlow()
    flow.addNode('beats')

    // Act
    const firstConnection = flow.connectNodes('beats-1', 'filter-starter')
    const duplicateConnection = flow.connectNodes('beats-1', 'filter-starter')
    const instrumentConnection = flow.connectNodes('filter-starter', 'beats-1')

    // Assert
    expect(firstConnection).toBe(true)
    expect(duplicateConnection).toBe(false)
    expect(instrumentConnection).toBe(false)
    expect(flow.edges.value).toHaveLength(3)
    expect(flow.compilation.value.code).toContain('stack(')
    expect(flow.compilation.value.code).toContain('.lpf(1500)')
  })

  it('refuses a cable that would close a loop', () => {
    // Arrange
    const flow = createFlow()
    flow.addNode('delay')
    flow.connectNodes('filter-starter', 'delay-1')

    // Act
    const closesLoop = flow.connectNodes('delay-1', 'filter-starter')

    // Assert
    expect(closesLoop).toBe(false)
    expect(flow.edges.value).toHaveLength(3)
    expect(
      compileStrudelFlow({
        nodes: flow.nodes.value,
        edges: flow.edges.value,
        beatsPerMinute: flow.beatsPerMinute.value,
        beatsPerCycle: flow.beatsPerCycle.value,
        setup: ''
      }).errorMessage
    ).toBeNull()
  })

  it('removes a node and the cables that touched it', () => {
    // Arrange
    const flow = createFlow()

    // Act
    flow.removeNode('filter-starter')

    // Assert
    expect(flow.nodes.value.map((node) => node.id)).toEqual(['pad-starter', 'voice-starter'])
    expect(flow.edges.value).toHaveLength(1)
  })

  it.each([
    [999, 300],
    [0, 1],
    [Number.NaN, 120]
  ])('keeps a tempo of %s inside the control as %s', (beatsPerMinute, expectedTempo) => {
    // Arrange
    const flow = createFlow()

    // Act
    flow.setBeatsPerMinute(beatsPerMinute)

    // Assert
    expect(flow.beatsPerMinute.value).toBe(expectedTempo)
    expect(flow.compilation.value.code.split('\n')[0]).toBe(`setcpm(${expectedTempo}/4)`)
  })

  it('saves every change to local storage, including an empty patch', async () => {
    // Arrange
    const flow = createFlow()

    // Act
    flow.addNode('space')
    flow.setBeatsPerMinute(140)
    await nextTick()
    const storedPatch = readStoredPatch()
    STARTER_IDS.forEach(flow.removeNode)
    flow.removeNode('space-1')
    await nextTick()

    // Assert
    expect(storedPatch?.beatsPerMinute).toBe(140)
    expect(storedPatch?.nodes).toHaveLength(4)
    expect(readStoredPatch()).toEqual({
      nodes: [],
      edges: [],
      beatsPerMinute: 140,
      beatsPerCycle: 4,
      setup: ''
    })
  })

  it('resets the patch and tempo to the starter state', async () => {
    // Arrange
    const flow = createFlow()
    flow.addNode('chords')
    flow.setBeatsPerMinute(70)
    await nextTick()

    // Act
    flow.resetPatch()
    await nextTick()

    // Assert
    expect(flow.nodes.value.map((node) => node.id)).toEqual(STARTER_IDS)
    expect(flow.edges.value).toHaveLength(2)
    expect(flow.beatsPerMinute.value).toBe(120)
    expect(readStoredPatch()?.beatsPerMinute).toBe(120)
  })
})
