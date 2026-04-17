<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { drawingStroke, drawingClear } from '@webgamekit/canvas-editor'

export type StrokeSegment = {
  x0: number
  y0: number
  x1: number
  y1: number
  color: string
  size: number
}

const ASPECT_RATIO = 3 / 2

const props = withDefaults(
  defineProps<{
    width?: number
    height?: number
    interactive: boolean
    color?: string
    size?: number
  }>(),
  {
    width: 600,
    height: 400,
    color: '#111111',
    size: 4
  }
)

const emit = defineEmits<{
  stroke: [segment: StrokeSegment]
  clear: []
}>()

const wrapperReference = ref<HTMLDivElement | null>(null)
const canvasReference = ref<HTMLCanvasElement | null>(null)
const lastPosition = ref<{ x: number; y: number } | null>(null)
const canvasDisplayWidth = ref('600px')
const canvasDisplayHeight = ref('400px')
let resizeObserver: ResizeObserver | null = null

const updateCanvasSize = (): void => {
  const wrapper = wrapperReference.value
  if (!wrapper) return
  const { clientWidth, clientHeight } = wrapper
  let displayWidth = clientWidth
  let displayHeight = displayWidth / ASPECT_RATIO
  if (displayHeight > clientHeight) {
    displayHeight = clientHeight
    displayWidth = displayHeight * ASPECT_RATIO
  }
  canvasDisplayWidth.value = `${Math.round(displayWidth)}px`
  canvasDisplayHeight.value = `${Math.round(displayHeight)}px`
}

const getContext = (): CanvasRenderingContext2D | null => {
  const canvas = canvasReference.value
  if (!canvas) return null
  return canvas.getContext('2d')
}

const getPointerPosition = (event: PointerEvent): { x: number; y: number } => {
  const canvas = canvasReference.value
  if (!canvas) return { x: 0, y: 0 }
  const rect = canvas.getBoundingClientRect()
  return {
    x: ((event.clientX - rect.left) * canvas.width) / rect.width,
    y: ((event.clientY - rect.top) * canvas.height) / rect.height
  }
}

const renderSegment = (segment: StrokeSegment): void => {
  const ctx = getContext()
  if (!ctx) return
  drawingStroke(
    ctx,
    { x: segment.x0, y: segment.y0 },
    { x: segment.x1, y: segment.y1 },
    { tool: 'brush', color: segment.color, size: segment.size }
  )
}

const clearCanvas = (): void => {
  const ctx = getContext()
  if (!ctx) return
  drawingClear(ctx)
}

const onPointerDown = (event: PointerEvent): void => {
  if (!props.interactive) return
  canvasReference.value?.setPointerCapture(event.pointerId)
  lastPosition.value = getPointerPosition(event)
}

const onPointerMove = (event: PointerEvent): void => {
  if (!props.interactive || !lastPosition.value) return
  const next = getPointerPosition(event)
  const segment: StrokeSegment = {
    x0: lastPosition.value.x,
    y0: lastPosition.value.y,
    x1: next.x,
    y1: next.y,
    color: props.color,
    size: props.size
  }
  renderSegment(segment)
  emit('stroke', segment)
  lastPosition.value = next
}

const onPointerUp = (event: PointerEvent): void => {
  canvasReference.value?.releasePointerCapture(event.pointerId)
  lastPosition.value = null
}

const clear = (): void => {
  clearCanvas()
  if (props.interactive) emit('clear')
}

defineExpose({
  renderSegment,
  clearCanvas,
  clear
})

onMounted(() => {
  const canvas = canvasReference.value
  if (!canvas) return
  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerup', onPointerUp)
  canvas.addEventListener('pointercancel', onPointerUp)

  updateCanvasSize()
  resizeObserver = new ResizeObserver(updateCanvasSize)
  if (wrapperReference.value) resizeObserver.observe(wrapperReference.value)
})

onUnmounted(() => {
  const canvas = canvasReference.value
  if (!canvas) return
  canvas.removeEventListener('pointerdown', onPointerDown)
  canvas.removeEventListener('pointermove', onPointerMove)
  canvas.removeEventListener('pointerup', onPointerUp)
  canvas.removeEventListener('pointercancel', onPointerUp)
  resizeObserver?.disconnect()
})
</script>

<template>
  <div ref="wrapperReference" class="drawing-canvas">
    <canvas
      ref="canvasReference"
      :width="width"
      :height="height"
      class="drawing-canvas__surface"
      :class="{ 'drawing-canvas__surface--interactive': interactive }"
      :style="{ width: canvasDisplayWidth, height: canvasDisplayHeight }"
    />
    <button v-if="interactive" class="drawing-canvas__clear-btn" type="button" @click="clear">
      Clear
    </button>
  </div>
</template>

<style scoped>
.drawing-canvas {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  align-items: center;
  justify-content: center;
  min-height: 0;
  min-width: 0;
  width: 100%;
  height: 100%;
}

.drawing-canvas__surface {
  display: block;
  position: relative;
  background: #fff;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  touch-action: none;
  cursor: default;
}

.drawing-canvas__surface--interactive {
  cursor: crosshair;
}

.drawing-canvas__clear-btn {
  padding: var(--spacing-1) var(--spacing-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-secondary);
  color: var(--color-foreground);
  font-size: var(--font-size-xs);
  cursor: pointer;
  flex-shrink: 0;
}

.drawing-canvas__clear-btn:hover {
  background: var(--color-muted);
}
</style>
