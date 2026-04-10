<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import CanvasEditorCanvas from './CanvasEditorCanvas.vue'
import CanvasEditorTools from './CanvasEditorTools.vue'
import type { DrawingTool, DrawingOptions } from '@webgamekit/canvas-editor'

const STORAGE_KEY_LAST = 'canvas-editor-last'

const props = withDefaults(
  defineProps<{
    tool?: DrawingTool
    color?: string
    size?: number
    canvasWidth?: number
    canvasHeight?: number
  }>(),
  {
    tool: 'brush',
    color: '#000000',
    size: 4,
    canvasWidth: 512,
    canvasHeight: 512
  }
)

const emit = defineEmits<{
  'update:tool': [value: DrawingTool]
  'update:color': [value: string]
  'update:size': [value: number]
  change: [dataUrl: string]
}>()

const canvasEditorCanvasReference = ref<InstanceType<typeof CanvasEditorCanvas> | null>(null)
const canUndo = ref(false)
const canRedo = ref(false)

const currentOptions = computed(
  (): DrawingOptions => ({
    tool: props.tool,
    color: props.color,
    size: props.size
  })
)

const getSnapshot = (): string => {
  const dataUrl = canvasEditorCanvasReference.value?.snapshot() ?? ''
  return JSON.stringify({ front: dataUrl, back: '' })
}

const handleChange = (dataUrl: string): void => {
  localStorage.setItem(STORAGE_KEY_LAST, JSON.stringify({ front: dataUrl, back: '' }))
  emit('change', dataUrl)
}

const handleHistoryChange = (state: { canUndo: boolean; canRedo: boolean }): void => {
  canUndo.value = state.canUndo
  canRedo.value = state.canRedo
}

const handleLoad = async (raw: string): Promise<void> => {
  const data = JSON.parse(raw) as { front: string; back?: string }
  const dataUrl = data.front
  if (dataUrl) await canvasEditorCanvasReference.value?.restore(dataUrl)
}

const undo = (): void => canvasEditorCanvasReference.value?.undo()
const redo = (): void => canvasEditorCanvasReference.value?.redo()
const clear = (): void => canvasEditorCanvasReference.value?.clear()

const onKeyDown = (event: KeyboardEvent): void => {
  const ctrl = event.ctrlKey || event.metaKey
  if (ctrl && event.key === 'z') {
    event.preventDefault()
    undo()
  }
  if (ctrl && (event.key === 'y' || (event.shiftKey && event.key === 'z'))) {
    event.preventDefault()
    redo()
  }
}

onMounted(async () => {
  const lastRaw = localStorage.getItem(STORAGE_KEY_LAST)
  if (lastRaw) {
    await handleLoad(lastRaw)
  }
  window.addEventListener('keydown', onKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
})
</script>

<template>
  <div class="canvas-editor">
    <CanvasEditorCanvas
      ref="canvasEditorCanvasReference"
      :options="currentOptions"
      :width="canvasWidth"
      :height="canvasHeight"
      @change="handleChange"
      @history-change="handleHistoryChange"
    />
    <CanvasEditorTools
      :tool="tool"
      :color="color"
      :size="size"
      :can-undo="canUndo"
      :can-redo="canRedo"
      :get-snapshot="getSnapshot"
      @update:tool="emit('update:tool', $event)"
      @update:color="emit('update:color', $event)"
      @update:size="emit('update:size', $event)"
      @undo="undo"
      @redo="redo"
      @clear="clear"
      @load="handleLoad"
    />
  </div>
</template>

<style scoped>
.canvas-editor {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
  height: 100%;
}
</style>
