import type { GlslToken, GlslTokenKind, ShaderLine, ShaderReading } from './types'

const KEYWORDS = new Set([
  'attribute',
  'break',
  'const',
  'continue',
  'discard',
  'else',
  'for',
  'if',
  'in',
  'inout',
  'out',
  'return',
  'struct',
  'uniform',
  'varying',
  'void',
  'while'
])

const TYPES = new Set([
  'bool',
  'float',
  'int',
  'mat2',
  'mat3',
  'mat4',
  'sampler2D',
  'samplerCube',
  'vec2',
  'vec3',
  'vec4'
])

const BUILTINS = new Set([
  'abs',
  'clamp',
  'cos',
  'dot',
  'floor',
  'fract',
  'length',
  'max',
  'min',
  'mix',
  'mod',
  'normalize',
  'pow',
  'sin',
  'smoothstep',
  'sqrt',
  'step',
  'texture2D',
  'texture2DProj'
])

/**
 * Split one line into text runs, keeping whitespace and punctuation as their own runs so the
 * line can be reassembled exactly as it was written.
 */
const RUN_PATTERN = /\s+|[A-Z_a-z]\w*|\d+\.?\d*|\.\d+|[^\s\w]/g

const classifyRun = (run: string, uniforms: Set<string>): GlslTokenKind => {
  if (uniforms.has(run)) return 'uniform'
  if (KEYWORDS.has(run)) return 'keyword'
  if (TYPES.has(run)) return 'type'
  if (BUILTINS.has(run)) return 'builtin'
  if (/^[\d.]/.test(run)) return 'number'
  return 'plain'
}

/** `uniform float rippleStrength;` and nothing else: the name is the third word. */
const UNIFORM_DECLARATION = /^\s*uniform\s+\w+\s+(\w+)\s*(?:\[[^\]]*])?\s*;/

/**
 * Colour one line of GLSL.
 *
 * ponytail: line by line, so a `/* … *\/` comment spanning lines is read as code after its
 * first line. Nothing in three's shaders or ours writes one; a tokeniser that carried state
 * between lines would be the fix if one ever did.
 * @param line The line to split
 * @param uniforms The uniform names the shader declares, coloured apart from other identifiers
 * @returns The line's text runs, in order, each tagged with what it is
 */
export const tokenizeGlslLine = (line: string, uniforms: Set<string> = new Set()): GlslToken[] => {
  if (line.trim().startsWith('#')) return [{ text: line, kind: 'preprocessor' }]

  const commentAt = line.indexOf('//')
  const code = commentAt === -1 ? line : line.slice(0, commentAt)
  const comment: GlslToken[] =
    commentAt === -1 ? [] : [{ text: line.slice(commentAt), kind: 'comment' }]

  const runs = code.match(RUN_PATTERN) ?? []
  return [...runs.map((run) => ({ text: run, kind: classifyRun(run, uniforms) })), ...comment]
}

/**
 * Read a shader into coloured lines, and work out which lines each uniform reaches.
 *
 * A control in a panel means nothing next to a wall of GLSL unless the reader can see where its
 * value lands, so every line records the uniforms it reads and the one it declares.
 * @param source The shader source, as the material carries it
 * @returns The coloured lines and the uniforms the source declares
 */
export const readShader = (source: string): ShaderReading => {
  const rawLines = source.split('\n')
  const uniforms = rawLines
    .map((line) => UNIFORM_DECLARATION.exec(line)?.[1])
    .filter((name): name is string => name !== undefined)
  const uniformSet = new Set(uniforms)

  const lines: ShaderLine[] = rawLines.map((line) => {
    const tokens = tokenizeGlslLine(line, uniformSet)
    const declares = UNIFORM_DECLARATION.exec(line)?.[1]
    const uses = tokens
      .filter((token) => token.kind === 'uniform' && token.text !== declares)
      .map((token) => token.text)
    return { tokens, declares, uses: [...new Set(uses)] }
  })

  return { lines, uniforms }
}
