<script setup lang="ts">
import { ref, computed } from 'vue'
import { useCanvasEditor } from './useCanvasEditor'
import type { DrawingOptions } from '@webgamekit/canvas-editor'

const props = defineProps<{
  options: DrawingOptions
  width: number
  height: number
  backgroundImage?: string
}>()

const emit = defineEmits<{
  change: [dataUrl: string]
  historyChange: [{ canUndo: boolean; canRedo: boolean }]
}>()

const canvasReference = ref<HTMLCanvasElement | null>(null)

const cursorX = ref(0)
const cursorY = ref(0)
const cursorVisible = ref(false)
const displayScale = ref(1)

const optionsReference = computed(() => props.options)

const showCircleCursor = computed(
  () => cursorVisible.value && (props.options.tool === 'brush' || props.options.tool === 'eraser')
)

const cursorRadius = computed(() => (props.options.size / 2) * displayScale.value)

const emitChange = (): void => {
  emit('change', canvasReference.value?.toDataURL() ?? '')
  emit('historyChange', {
    canUndo: editor.canUndo.value,
    canRedo: editor.canRedo.value
  })
}

const editor = useCanvasEditor(canvasReference, optionsReference, emitChange)

const updateCursor = (event: MouseEvent): void => {
  if (!canvasReference.value) return
  const rect = canvasReference.value.getBoundingClientRect()
  displayScale.value = rect.width / props.width
  cursorX.value = event.clientX - rect.left
  cursorY.value = event.clientY - rect.top
}

const onMouseEnter = (event: MouseEvent): void => {
  cursorVisible.value = true
  updateCursor(event)
}

const onMouseMove = (event: MouseEvent): void => {
  updateCursor(event)
  editor.onPointerMove(event)
}

const onMouseLeave = (): void => {
  cursorVisible.value = false
  editor.onPointerUp()
}

const snapshot = (): string => canvasReference.value?.toDataURL() ?? ''

defineExpose({
  undo: editor.undo,
  redo: editor.redo,
  clear: editor.clear,
  restore: editor.restore,
  snapshot
})
</script>

<template>
  <div class="canvas-editor-canvas">
    <div class="canvas-editor-canvas__wrapper" :style="{ aspectRatio: `${width} / ${height}` }">
      <img
        v-if="backgroundImage"
        :src="backgroundImage"
        class="canvas-editor-canvas__background"
        aria-hidden="true"
      />

      <svg v-if="showCircleCursor" class="canvas-editor-canvas__cursor-overlay">
        <circle
          :cx="cursorX"
          :cy="cursorY"
          :r="cursorRadius"
          class="canvas-editor-canvas__cursor-circle"
        />
      </svg>

      <canvas
        ref="canvasReference"
        class="canvas-editor-canvas__canvas"
        :class="{ 'canvas-editor-canvas__canvas--hide-cursor': showCircleCursor }"
        :width="width"
        :height="height"
        @mouseenter="onMouseEnter"
        @mousemove="onMouseMove"
        @mouseleave="onMouseLeave"
        @mousedown="editor.onPointerDown"
        @mouseup="editor.onPointerUp"
        @touchstart.prevent="editor.onTouchStart"
        @touchmove.prevent="editor.onTouchMove"
        @touchend="editor.onTouchEnd"
      />
    </div>
  </div>
</template>

<style scoped>
.canvas-editor-canvas {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.canvas-editor-canvas__wrapper {
  position: relative;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--color-background);
  width: 100%;
}

.canvas-editor-canvas__background {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
  opacity: 0.15;
  z-index: 0;
}

.canvas-editor-canvas__cursor-overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1;
}

.canvas-editor-canvas__cursor-circle {
  fill: none;
  stroke: var(--color-foreground);
  stroke-width: 1.5;
  opacity: 0.7;
}

.canvas-editor-canvas__canvas {
  display: block;
  width: 100%;
  height: 100%;
  touch-action: none;
  cursor: crosshair;
}

.canvas-editor-canvas__canvas--hide-cursor {
  cursor: none;
}
</style>
