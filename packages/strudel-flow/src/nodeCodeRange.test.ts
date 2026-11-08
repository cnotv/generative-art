import { describe, expect, it } from 'vitest'
import { compileStrudelFlow } from './compileStrudelFlow'
import {
  findStrudelFlowNodeCode,
  findStrudelFlowPlayingNodeIds,
  getStrudelFlowNodeCodeRanges
} from './nodeCodeRange'
import { parseStrudelFlowCode } from './parseStrudelFlowCode'

const SONG = `// a kick that drops out, with s() in a comment
const body = "<0!16 1!40>"
$: stack(
  s("bd*4").gain(.5).mask("<1!40 0!8>"),
  s("~ cp ~ cp").gain(.3).mask(body)
)._punchcard()
$: note("c2 e2").s("sawtooth").lpf(400).gain(.6)`

const parsedSong = () => {
  const patch = parseStrudelFlowCode(SONG)
  if (patch === null) {
    throw new Error('the song does not parse')
  }
  return patch
}

const codeOf = (code: string, nodeId: string): string | null => {
  const patch = parseStrudelFlowCode(code) ?? parsedSong()
  const range = findStrudelFlowNodeCode(code, patch.nodes, patch.edges, nodeId)
  return range === null ? null : code.slice(range.from, range.to)
}

describe('findStrudelFlowNodeCode', () => {
  it.each([
    ['beats-1', 's("bd*4")'],
    ['beats-2', 's("~ cp ~ cp")'],
    ['gain-2', 'gain(.3)'],
    ['mask-1', 'mask("<1!40 0!8>")'],
    ['mask-2', 'mask(body)'],
    ['visualizer-1', '_punchcard()'],
    ['voice-1', 's("sawtooth")'],
    ['gain-3', 'gain(.6)']
  ])('finds the code %s writes in hand-written code', (nodeId, expectedCode) => {
    // Act
    const found = codeOf(SONG, nodeId)

    // Assert
    expect(found).toBe(expectedCode)
  })

  it('finds a node in the code the patch compiles to', () => {
    // Arrange
    const compiled = compileStrudelFlow(parsedSong()).code

    // Act
    const found = codeOf(compiled, 'mask-2')

    // Assert
    expect(found).toBe('mask(body)')
  })

  it('gives null for a node that is not in the patch', () => {
    // Arrange
    const patch = parsedSong()

    // Act
    const range = findStrudelFlowNodeCode(SONG, patch.nodes, patch.edges, 'missing-1')

    // Assert
    expect(range).toBeNull()
  })
})

describe('getStrudelFlowNodeCodeRanges', () => {
  it('gives every node of the song its range', () => {
    // Arrange
    const patch = parsedSong()

    // Act
    const ranges = getStrudelFlowNodeCodeRanges(SONG, patch.nodes, patch.edges)

    // Assert
    const found = Object.fromEntries(
      ranges.map((range) => [range.nodeId, SONG.slice(range.from, range.to)])
    )
    expect(found).toMatchObject({
      'beats-1': 's("bd*4")',
      'gain-2': 'gain(.3)',
      'mask-2': 'mask(body)',
      'voice-1': 's("sawtooth")'
    })
  })

  it('gives a beats node one range for each sounding row', () => {
    // Arrange
    const code = '$: stack(\n  s("bd*4"),\n  s("hh*8")\n)'
    const patch = parseStrudelFlowCode(code) ?? parsedSong()
    const beatsNode = patch.nodes.find((node) => node.data.kind === 'beats')

    // Act
    const ranges = getStrudelFlowNodeCodeRanges(code, patch.nodes, patch.edges)

    // Assert
    const own = ranges.filter((range) => range.nodeId === beatsNode?.id)
    expect(own.length).toBeGreaterThan(0)
    expect(own.map((range) => code.slice(range.from, range.to))).toContain('s("bd*4")')
  })
})

const playingIds = (code: string, offsetsPerHap: number[][]): string[] => {
  const patch = parseStrudelFlowCode(code)
  if (patch === null) {
    throw new Error('the code does not parse')
  }
  const ranges = getStrudelFlowNodeCodeRanges(code, patch.nodes, patch.edges)
  return findStrudelFlowPlayingNodeIds(ranges, offsetsPerHap, patch.nodes, patch.edges)
}

describe('findStrudelFlowPlayingNodeIds', () => {
  const RIFF = 'const riff = "<[d2 ~ d2 f2]>"\n$: note(riff).s("gm_electric_bass_pick").lpf(700)'

  it('finds the head node for an offset inside its mini-notation', () => {
    // Arrange
    const offset = SONG.indexOf('bd*4')

    // Act
    const ids = playingIds(SONG, [[offset]])

    // Assert
    expect(ids).toEqual(['beats-1'])
  })

  it('finds the instrument upstream of a gain node whose arguments sound', () => {
    // Arrange
    const offset = SONG.indexOf('.3)')

    // Act
    const ids = playingIds(SONG, [[offset]])

    // Assert
    expect(ids).toEqual(['beats-2'])
  })

  it('ignores an offset in the setup line', () => {
    // Arrange
    const offset = SONG.indexOf('const body')

    // Act
    const ids = playingIds(SONG, [[offset]])

    // Assert
    expect(ids).toEqual([])
  })

  it('lists a node once however many haps fall in it', () => {
    // Arrange
    const offset = SONG.indexOf('bd*4')

    // Act
    const ids = playingIds(SONG, [[offset], [offset + 1]])

    // Assert
    expect(ids).toEqual(['beats-1'])
  })

  it.each([
    ['head first', ['note("c2 e2")', '"sawtooth"']],
    ['head last', ['"sawtooth"', 'note("c2 e2")']]
  ])('prefers the notes node over the voice in one hap, %s', (_label, snippets) => {
    // Arrange
    const offsets = snippets.map((snippet) => SONG.indexOf(snippet) + 1)

    // Act
    const ids = playingIds(SONG, [offsets])

    // Assert
    expect(ids).toEqual(['notes-1'])
  })

  it.each([
    ['the riff and the voice', ['"<[d2', '"gm_electric_bass_pick"']],
    ['the voice alone', ['"gm_electric_bass_pick"']]
  ])('lights the notes node when a note sounds from %s', (_label, snippets) => {
    // Arrange
    const offsets = snippets.map((snippet) => RIFF.indexOf(snippet) + 1)

    // Act
    const ids = playingIds(RIFF, [offsets])

    // Assert
    expect(ids).toEqual(['notes-1'])
  })

  it('lights nothing when the only owner is an effect shared by two instruments', () => {
    // Arrange
    const code = '$: stack(s("bd*4"), note("c2 e2")).lpf(700)'
    const offset = code.indexOf('700')

    // Act
    const ids = playingIds(code, [[offset]])

    // Assert
    expect(ids).toEqual([])
  })
})
