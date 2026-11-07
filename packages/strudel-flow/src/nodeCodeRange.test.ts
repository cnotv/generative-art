import { describe, expect, it } from 'vitest'
import { compileStrudelFlow } from './compileStrudelFlow'
import { findStrudelFlowNodeCode } from './nodeCodeRange'
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
