import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ShaderCode from './ShaderCode.vue'

const SOURCE = [
  'uniform float rippleScale;',
  'uniform float time;',
  'uniform vec3 unused;',
  '',
  'void main() {',
  '  float wave = sin( vUv.y * rippleScale + time );',
  '  gl_FragColor = vec4( wave );',
  '}'
].join('\n')

const render = (props: Record<string, unknown> = {}) =>
  mount(ShaderCode, { props: { source: SOURCE, ...props } })

const activeText = (wrapper: ReturnType<typeof render>) =>
  wrapper.findAll('.shader-code__line--active').map((line) => line.text().trim())

describe('ShaderCode', () => {
  it('shows the source as one line per line of the shader', () => {
    expect(render().findAll('.shader-code__line')).toHaveLength(8)
  })

  it('writes the current value beside the uniform it belongs to', () => {
    const wrapper = render({ values: { rippleScale: 120 } })
    const annotations = wrapper.findAll('.shader-code__annotation').map((note) => note.text())
    expect(annotations[0]).toBe('// 120')
  })

  it('says a uniform with no control is set in code rather than leaving it blank', () => {
    const wrapper = render({ values: { rippleScale: 120 } })
    const annotations = wrapper.findAll('.shader-code__annotation').map((note) => note.text())
    expect(annotations[1]).toBe('// set in code')
  })

  it('marks nothing until a control has been touched', () => {
    expect(activeText(render({ values: { rippleScale: 120 } }))).toEqual([])
  })

  it('marks the declaration and every line that reads the touched uniform', () => {
    const wrapper = render({ values: { rippleScale: 120 }, active: 'rippleScale' })
    expect(activeText(wrapper)).toEqual([
      'uniform float rippleScale; // 120',
      'float wave = sin( vUv.y * rippleScale + time );'
    ])
  })

  it('counts the lines the touched uniform reaches, in the caption', () => {
    const wrapper = render({ values: { rippleScale: 120 }, active: 'rippleScale' })
    expect(wrapper.find('.shader-code__caption').text()).toContain('reaches 2 lines')
  })

  it('says line rather than lines for a uniform that reaches only its own declaration', () => {
    const wrapper = render({ active: 'unused' })
    expect(wrapper.find('.shader-code__caption').text()).toContain('reaches 1 line')
  })

  it('colours a uniform apart from the identifiers around it', () => {
    const wrapper = render()
    const names = wrapper.findAll('.shader-code__token--uniform').map((token) => token.text())
    expect(new Set(names)).toEqual(new Set(['rippleScale', 'time', 'unused']))
  })
})
