import { describe, it, expect } from 'vitest'
import { readShader, tokenizeGlslLine } from './glsl'

const asText = (source: string): string =>
  readShader(source)
    .lines.map((line) => line.tokens.map((token) => token.text).join(''))
    .join('\n')

describe('tokenizeGlslLine', () => {
  it('reads a whole preprocessor line as one run', () => {
    expect(tokenizeGlslLine('    #include <fog_fragment>')).toEqual([
      { text: '    #include <fog_fragment>', kind: 'preprocessor' }
    ])
  })

  it('separates a trailing comment from the code before it', () => {
    const kinds = tokenizeGlslLine('float speed; // how fast').map((token) => token.kind)
    expect(kinds).toContain('type')
    expect(kinds.at(-1)).toBe('comment')
  })

  it('leaves a // inside a comment alone rather than splitting again', () => {
    const tokens = tokenizeGlslLine('// see https://example.test/a')
    expect(tokens).toEqual([{ text: '// see https://example.test/a', kind: 'comment' }])
  })

  it.each([
    ['uniform', 'keyword'],
    ['vec3', 'type'],
    ['smoothstep', 'builtin'],
    ['0.45', 'number'],
    ['.5', 'number'],
    ['vSurfaceUv', 'plain']
  ] as const)('tags %s as %s', (run, kind) => {
    expect(tokenizeGlslLine(run)[0]).toEqual({ text: run, kind })
  })

  it('tags a declared uniform apart from any other identifier', () => {
    const tokens = tokenizeGlslLine('rippleSpeed * other', new Set(['rippleSpeed']))
    expect(tokens[0]).toEqual({ text: 'rippleSpeed', kind: 'uniform' })
    expect(tokens.at(-1)).toEqual({ text: 'other', kind: 'plain' })
  })
})

describe('readShader', () => {
  const source = [
    'uniform float rippleSpeed;',
    'uniform vec3 color;',
    'varying vec2 vUv;',
    '',
    'void main() {',
    '  float wave = sin( vUv.y + time * rippleSpeed );',
    '  gl_FragColor = vec4( color * wave, 1.0 );',
    '}'
  ].join('\n')

  it('finds every uniform the source declares, and nothing else', () => {
    expect(readShader(source).uniforms).toEqual(['rippleSpeed', 'color'])
  })

  it('reassembles the source exactly, so nothing is lost in the colouring', () => {
    expect(asText(source)).toBe(source)
  })

  it('names the uniform a declaration line declares', () => {
    expect(readShader(source).lines[0].declares).toBe('rippleSpeed')
    expect(readShader(source).lines[2].declares).toBeUndefined()
  })

  it('does not count a declaration as a use of the uniform it declares', () => {
    expect(readShader(source).lines[0].uses).toEqual([])
  })

  it('records which uniforms each line reads', () => {
    const { lines } = readShader(source)
    expect(lines[5].uses).toEqual(['rippleSpeed'])
    expect(lines[6].uses).toEqual(['color'])
  })

  it('lists a uniform read twice on one line only once', () => {
    const { lines } = readShader('uniform float a;\nfloat b = a * a;')
    expect(lines[1].uses).toEqual(['a'])
  })

  it('keeps a line for every line of the source, blank ones included', () => {
    expect(readShader(source).lines).toHaveLength(8)
    expect(readShader(source).lines[3].tokens).toEqual([])
  })
})
