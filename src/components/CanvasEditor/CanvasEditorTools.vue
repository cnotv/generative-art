<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { ColorPicker } from '@/components/ui/color-picker'
import BrushSize from './BrushSize.vue'
import { Brush, Eraser, PaintBucket, Undo2, Redo2, Trash2, Download } from 'lucide-vue-next'
import type { DrawingTool } from '@webgamekit/canvas-editor'

const props = defineProps<{
  tool: DrawingTool
  color: string
  size: number
  canUndo: boolean
  canRedo: boolean
  slotName: string
  getSnapshot: () => string
}>()

const emit = defineEmits<{
  'update:tool': [value: DrawingTool]
  'update:color': [value: string]
  'update:size': [value: number]
  undo: []
  redo: []
  clear: []
}>()

const download = (): void => {
  const snapshot = props.getSnapshot()
  const dataUrl = (JSON.parse(snapshot) as { front: string }).front
  if (!dataUrl) return
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = `${props.slotName}.png`
  link.click()
}
</script>

<template>
  <div class="canvas-editor-tools">
    <Button
      :variant="tool === 'brush' ? 'default' : 'outline'"
      size="icon"
      title="Brush"
      @click="emit('update:tool', 'brush')"
    >
      <Brush class="canvas-editor-tools__icon" />
    </Button>
    <Button
      :variant="tool === 'eraser' ? 'default' : 'outline'"
      size="icon"
      title="Eraser"
      @click="emit('update:tool', 'eraser')"
    >
      <Eraser class="canvas-editor-tools__icon" />
    </Button>
    <Button
      :variant="tool === 'fill' ? 'default' : 'outline'"
      size="icon"
      title="Fill"
      @click="emit('update:tool', 'fill')"
    >
      <PaintBucket class="canvas-editor-tools__icon" />
    </Button>
    <ColorPicker
      :model-value="color"
      title="Color"
      @update:model-value="emit('update:color', $event)"
    />
    <BrushSize
      :model-value="size"
      :min="1"
      :max="80"
      @update:model-value="emit('update:size', $event)"
    />
    <Button
      variant="outline"
      size="icon"
      :disabled="!canUndo"
      title="Undo (Ctrl+Z)"
      @click="emit('undo')"
    >
      <Undo2 class="canvas-editor-tools__icon" />
    </Button>
    <Button
      variant="outline"
      size="icon"
      :disabled="!canRedo"
      title="Redo (Ctrl+Y)"
      @click="emit('redo')"
    >
      <Redo2 class="canvas-editor-tools__icon" />
    </Button>
    <Button variant="destructive" size="icon" title="Clear canvas" @click="emit('clear')">
      <Trash2 class="canvas-editor-tools__icon" />
    </Button>
    <Button variant="outline" size="icon" title="Download as PNG" @click="download">
      <Download class="canvas-editor-tools__icon" />
    </Button>
  </div>
</template>

<style scoped>
.canvas-editor-tools {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-2);
  align-items: center;
  padding: var(--spacing-3) var(--spacing-4);
  background: var(--color-secondary);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.canvas-editor-tools__icon {
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
}
</style>
