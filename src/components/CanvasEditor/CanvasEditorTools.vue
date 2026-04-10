<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { ColorPicker } from '@/components/ui/color-picker'
import BrushSize from './BrushSize.vue'
import { Brush, Eraser, PaintBucket, Undo2, Redo2, Trash2, Save } from 'lucide-vue-next'
import { storageSave } from '@webgamekit/canvas-editor'
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

const save = async (): Promise<void> => {
  await storageSave('localStorage', props.slotName, props.getSnapshot())
}
</script>

<template>
  <div class="canvas-editor-tools">
    <div class="canvas-editor-tools__group">
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
    </div>

    <div class="canvas-editor-tools__group">
      <label class="canvas-editor-tools__label">
        Color
        <ColorPicker :model-value="color" @update:model-value="emit('update:color', $event)" />
      </label>
      <BrushSize
        :model-value="size"
        :min="1"
        :max="80"
        @update:model-value="emit('update:size', $event)"
      />
    </div>

    <div class="canvas-editor-tools__group">
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
      <Button size="sm" title="Save" @click="save">
        <Save class="canvas-editor-tools__icon canvas-editor-tools__icon--mr" />
        Save
      </Button>
    </div>
  </div>
</template>

<style scoped>
.canvas-editor-tools {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-4);
  align-items: center;
  padding: var(--spacing-3) var(--spacing-4);
  background: var(--color-secondary);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.canvas-editor-tools__group {
  display: flex;
  gap: var(--spacing-2);
  align-items: center;
}

.canvas-editor-tools__label {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  font-size: var(--font-size-xs);
  color: var(--color-muted-foreground);
  cursor: pointer;
}

.canvas-editor-tools__icon {
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
}

.canvas-editor-tools__icon--mr {
  margin-right: var(--spacing-1);
}
</style>
