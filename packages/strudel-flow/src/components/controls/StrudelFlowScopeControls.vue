<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import StrudelFlowKnob from './StrudelFlowKnob.vue'
import type { StrudelFlowScopeData } from '../../types'

const props = defineProps<{
  data: StrudelFlowScopeData
}>()

const emit = defineEmits<{
  update: [data: StrudelFlowScopeData]
}>()

const canvas = ref<HTMLCanvasElement | null>(null)
let animationFrame = 0

const drawWaveform = (time: number): void => {
  const element = canvas.value
  const context = element?.getContext('2d')
  if (element === null || context === null) {
    return
  }
  const ratio = window.devicePixelRatio || 1
  const width = Math.round(element.clientWidth * ratio)
  const height = Math.round(element.clientHeight * ratio)
  if (element.width !== width || element.height !== height) {
    element.width = width
    element.height = height
  }
  context.clearRect(0, 0, width, height)
  context.strokeStyle = getComputedStyle(element).color
  context.lineWidth = 1.5 * ratio
  context.lineCap = 'round'
  context.beginPath()
  const amplitude = height * 0.04 * (0.5 + props.data.scale)
  // Canvas drawing is inherently sequential; a loop reads clearer than a mapped range here.
  // eslint-disable-next-line functional/no-loop-statements
  for (let x = 0; x <= width; x += 2) {
    const phase = (x / width) * Math.PI * 8 + time / 600
    const envelope = Math.sin((x / width) * Math.PI)
    const y = height / 2 + Math.sin(phase) * amplitude * envelope
    if (x === 0) {
      context.moveTo(x, y)
    } else {
      context.lineTo(x, y)
    }
  }
  context.stroke()
}

const animate = (time: number): void => {
  drawWaveform(time)
  animationFrame = window.requestAnimationFrame(animate)
}

onMounted(() => {
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  if (reduceMotion) {
    drawWaveform(0)
    return
  }
  animationFrame = window.requestAnimationFrame(animate)
})

onBeforeUnmount(() => {
  window.cancelAnimationFrame(animationFrame)
})

const onScaleChange = (scale: number): void => {
  emit('update', { ...props.data, scale })
}
</script>

<template>
  <div class="strudel-flow-scope">
    <canvas
      ref="canvas"
      class="strudel-flow-scope__canvas"
      role="img"
      aria-label="Audio waveform"
    />
    <StrudelFlowKnob
      label="Scale"
      :model-value="data.scale"
      :min="0.1"
      :max="4"
      :step="0.05"
      @update:model-value="onScaleChange"
    />
  </div>
</template>
