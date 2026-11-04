import { afterEach, describe, it, expect } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { defineComponent, h, onMounted, ref } from 'vue'
import { useComponentFrame } from './useComponentFrame'

const NETWORK_REACHED = 1
const NETWORK_BLOCKED = -1

// Reports through the only channel the frame has whether a request left it. `no-cors` resolves
// for any reachable URL, so a resolved promise means the request was sent.
const createNetworkProbeSource = (targetUrl: string): string => `<script setup>
const emit = defineEmits(['update'])
fetch('${targetUrl}', { mode: 'no-cors' }).then(
  () => emit('update', { count: ${NETWORK_REACHED} }),
  () => emit('update', { count: ${NETWORK_BLOCKED} })
)
</script>

<template><p>probe</p></template>
`

const mountFrameWithSource = (source: string) => {
  const harness = defineComponent({
    setup() {
      const frameElement = ref<HTMLIFrameElement | null>(null)
      const {
        state,
        frameDocument,
        mount: mountSource
      } = useComponentFrame(frameElement, {
        count: 0
      })
      onMounted(() => mountSource(source))
      return () => [
        h('iframe', { ref: frameElement, sandbox: 'allow-scripts', srcdoc: frameDocument }),
        h('output', { 'data-testid': 'count' }, String(state.value.count))
      ]
    }
  })
  mount(harness, { attachTo: document.body })
}

const readCount = (): string => document.querySelector('[data-testid="count"]')?.textContent ?? ''

describe('useComponentFrame sandbox', () => {
  enableAutoUnmount(afterEach)

  it('blocks network requests from the mounted component', async () => {
    // Arrange
    const targetUrl = `${window.location.origin}/?generative-canvas-probe`

    // Act
    mountFrameWithSource(createNetworkProbeSource(targetUrl))

    // Assert
    await expect.poll(readCount).toBe(String(NETWORK_BLOCKED))
  })
})
