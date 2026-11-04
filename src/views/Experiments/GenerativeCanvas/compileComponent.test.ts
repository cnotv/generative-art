import { describe, it, expect } from 'vitest'
import { compileComponent } from './compileComponent'

const SCRIPT_SETUP_COMPONENT = `
<script setup>
const props = defineProps({ count: Number })
const emit = defineEmits(['update'])
</script>

<template>
  <button @click="emit('update', { count: props.count + 1 })">{{ props.count }}</button>
</template>

<style scoped>
button { color: red; }
</style>
`

const OPTIONS_COMPONENT = `
<script>
export default { props: { count: Number } }
</script>

<template>
  <p>{{ count }}</p>
</template>
`

const TEMPLATE_ONLY_COMPONENT = '<template><p>Hello</p></template>'

describe('compileComponent', () => {
  it.each([
    ['script setup', SCRIPT_SETUP_COMPONENT],
    ['an options object', OPTIONS_COMPONENT],
    ['a template only', TEMPLATE_ONLY_COMPONENT]
  ])('compiles %s into a module with a default export', (_label, source) => {
    // Act
    const result = compileComponent(source, 'abc123')

    // Assert
    expect(result.ok).toBe(true)
    expect(result.ok && result.code).toContain('export default')
  })

  it('compiles an options component with a render function attached', () => {
    // Act
    const result = compileComponent(OPTIONS_COMPONENT, 'abc123')

    // Assert
    expect(result.ok && result.code).toMatch(/\.render\s*=\s*render/)
  })

  it('scopes styles to the component id', () => {
    // Act
    const result = compileComponent(SCRIPT_SETUP_COMPONENT, 'abc123')

    // Assert
    expect(result.ok && result.css).toContain('[data-v-abc123]')
    expect(result.ok && result.code).toContain('data-v-abc123')
  })

  it.each([
    ['an unclosed template', '<template><p>Hello</template>'],
    ['a script syntax error', '<script setup>const = 1</script><template><p /></template>'],
    [
      'TypeScript',
      '<script setup lang="ts">const count: number = 1</script><template><p /></template>'
    ],
    ['no template and no script', '<style>p { color: red; }</style>']
  ])('reports an error for %s', (_label, source) => {
    // Act
    const result = compileComponent(source, 'abc123')

    // Assert
    expect(result.ok).toBe(false)
    expect(!result.ok && result.error.length).toBeGreaterThan(0)
  })
})
