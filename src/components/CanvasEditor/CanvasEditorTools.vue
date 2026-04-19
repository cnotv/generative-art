<script setup lang="ts">
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import { ColorPicker } from '@/components/ui/color-picker'
import BrushSize from './BrushSize.vue'
import { Brush, Eraser, PaintBucket, Undo2, Redo2, Trash2, Download } from 'lucide-vue-next'
import type { DrawingTool } from '@webgamekit/canvas-editor'
import type { CanvasEditorToolButton } from './types'

const props = withDefaults(
  defineProps<{
    tool: DrawingTool
    color: string
    size: number
    canUndo: boolean
    canRedo: boolean
    slotName: string
    getSnapshot: () => string
    visibleTools?: readonly CanvasEditorToolButton[]
    hideColorValue?: boolean
  }>(),
  {
    hideColorValue: true,
    visibleTools: () => [
      'brush',
      'eraser',
      'fill',
      'color',
      'size',
      'undo',
      'redo',
      'clear',
      'download'
    ]
  }
)

const show = computed(() => new Set(props.visibleTools))

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
      v-if="show.has('brush')"
      :variant="tool === 'brush' ? 'default' : 'outline'"
      size="icon"
      title="Brush"
      @click="emit('update:tool', 'brush')"
    >
      <Brush class="canvas-editor-tools__icon" />
    </Button>
    <Button
      v-if="show.has('eraser')"
      :variant="tool === 'eraser' ? 'default' : 'outline'"
      size="icon"
      title="Eraser"
      @click="emit('update:tool', 'eraser')"
    >
      <Eraser class="canvas-editor-tools__icon" />
    </Button>
    <Button
      v-if="show.has('fill')"
      :variant="tool === 'fill' ? 'default' : 'outline'"
      size="icon"
      title="Fill"
      @click="emit('update:tool', 'fill')"
    >
      <PaintBucket class="canvas-editor-tools__icon" />
    </Button>
    <ColorPicker
      v-if="show.has('color')"
      :model-value="color"
      :hide-value="hideColorValue"
      title="Color"
      @update:model-value="emit('update:color', $event)"
    />
    <BrushSize
      v-if="show.has('size')"
      :model-value="size"
      :min="1"
      :max="80"
      @update:model-value="emit('update:size', $event)"
    />
    <Button
      v-if="show.has('undo')"
      variant="outline"
      size="icon"
      :disabled="!canUndo"
      title="Undo (Ctrl+Z)"
      @click="emit('undo')"
    >
      <Undo2 class="canvas-editor-tools__icon" />
    </Button>
    <Button
      v-if="show.has('redo')"
      variant="outline"
      size="icon"
      :disabled="!canRedo"
      title="Redo (Ctrl+Y)"
      @click="emit('redo')"
    >
      <Redo2 class="canvas-editor-tools__icon" />
    </Button>
    <Button
      v-if="show.has('clear')"
      variant="destructive"
      size="icon"
      title="Clear canvas"
      @click="emit('clear')"
    >
      <Trash2 class="canvas-editor-tools__icon" />
    </Button>
    <Button
      v-if="show.has('download')"
      variant="outline"
      size="icon"
      title="Download as PNG"
      @click="download"
    >
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
  background: transparent;
  border-radius: var(--radius-md);
}

.canvas-editor-tools__icon {
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
}
</style>
