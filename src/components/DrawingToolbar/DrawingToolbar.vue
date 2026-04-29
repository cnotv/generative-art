<script setup lang="ts">
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import { ColorPicker } from '@/components/ui/color-picker'
import BrushSize from '@/components/CanvasEditor/BrushSize.vue'
import { Brush, Eraser, PaintBucket, RotateCw } from 'lucide-vue-next'

export type DrawingTool = 'brush' | 'eraser' | 'fill' | 'rotate'
export type DrawingToolbarButton = DrawingTool | 'color' | 'size'

const props = withDefaults(
  defineProps<{
    tool: DrawingTool
    color: string
    size: number
    visibleTools?: readonly DrawingToolbarButton[]
  }>(),
  {
    visibleTools: () => ['brush', 'eraser', 'fill', 'color', 'size']
  }
)

const emit = defineEmits<{
  'update:tool': [value: DrawingTool]
  'update:color': [value: string]
  'update:size': [value: number]
}>()

const show = computed(() => new Set(props.visibleTools))
</script>

<template>
  <div class="drawing-toolbar">
    <Button
      v-if="show.has('brush')"
      :variant="tool === 'brush' ? 'default' : 'outline'"
      size="icon"
      title="Brush"
      @click="emit('update:tool', 'brush')"
    >
      <Brush class="drawing-toolbar__icon" />
    </Button>
    <Button
      v-if="show.has('eraser')"
      :variant="tool === 'eraser' ? 'default' : 'outline'"
      size="icon"
      title="Eraser"
      @click="emit('update:tool', 'eraser')"
    >
      <Eraser class="drawing-toolbar__icon" />
    </Button>
    <Button
      v-if="show.has('fill')"
      :variant="tool === 'fill' ? 'default' : 'outline'"
      size="icon"
      title="Fill"
      @click="emit('update:tool', 'fill')"
    >
      <PaintBucket class="drawing-toolbar__icon" />
    </Button>
    <Button
      v-if="show.has('rotate')"
      :variant="tool === 'rotate' ? 'default' : 'outline'"
      size="icon"
      title="Rotate sphere"
      @click="emit('update:tool', 'rotate')"
    >
      <RotateCw class="drawing-toolbar__icon" />
    </Button>
    <ColorPicker
      v-if="show.has('color')"
      :model-value="color"
      :hide-value="true"
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
  </div>
</template>

<style scoped>
.drawing-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-2);
  align-items: center;
}

.drawing-toolbar__icon {
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
}
</style>
