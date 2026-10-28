<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { StrudelFlowVisualizerData } from '../../types'

const props = defineProps<{
  placement: StrudelFlowVisualizerData['placement']
  /** The canvas Strudel paints this node's visual on, or null when it is not in the code. */
  widgetId: string | null
}>()

const previewCanvas = ref<HTMLCanvasElement | null>(null)
const isMirroring = ref(false)
let frameRequest: number | null = null

const message = computed(() => {
  if (props.placement === 'background') {
    return 'Behind the code draws behind the code editor; switch to Code to watch it.'
  }
  return props.widgetId === null
    ? 'Connect an instrument to draw its visual here.'
    : 'Press Play to draw the visual here.'
})

const readSourceCanvas = (): HTMLCanvasElement | null => {
  const source = props.widgetId === null ? null : document.getElementById(props.widgetId)
  return source instanceof HTMLCanvasElement && source.width > 0 && source.height > 0
    ? source
    : null
}

// Strudel paints into a canvas inside the code editor, which the flow hides, so each frame
// copies that canvas here rather than moving it out from under the editor.
const mirrorFrame = (): void => {
  const source = props.placement === 'inline' ? readSourceCanvas() : null
  const target = previewCanvas.value
  const context = target?.getContext('2d')
  if (source !== null && target !== null && context !== null && context !== undefined) {
    if (target.width !== source.width || target.height !== source.height) {
      target.width = source.width
      target.height = source.height
    }
    context.clearRect(0, 0, target.width, target.height)
    context.drawImage(source, 0, 0)
  }
  if (isMirroring.value !== (source !== null)) {
    isMirroring.value = source !== null
  }
  frameRequest = window.requestAnimationFrame(mirrorFrame)
}

onMounted(() => {
  frameRequest = window.requestAnimationFrame(mirrorFrame)
})

onBeforeUnmount(() => {
  if (frameRequest !== null) {
    window.cancelAnimationFrame(frameRequest)
  }
})
</script>

<template>
  <div class="strudel-flow-visual-preview">
    <canvas
      v-show="isMirroring"
      ref="previewCanvas"
      class="strudel-flow-visual-preview__canvas"
      role="img"
      aria-label="Live visual of the pattern"
    />
    <p v-if="!isMirroring" class="strudel-flow-visualizer__hint">{{ message }}</p>
  </div>
</template>
