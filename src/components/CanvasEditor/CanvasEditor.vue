<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import CanvasEditorCanvas from './CanvasEditorCanvas.vue'
import CanvasEditorTools from './CanvasEditorTools.vue'
import { storageLoad } from '@webgamekit/canvas-editor'
import type { DrawingTool, DrawingOptions } from '@webgamekit/canvas-editor'

const props = withDefaults(
  defineProps<{
    tool?: DrawingTool
    color?: string
    size?: number
    slotName?: string
    canvasWidth?: number
    canvasHeight?: number
    backgroundImage?: string
    defaultImage?: string
  }>(),
  {
    tool: 'brush',
    color: '#000000',
    size: 10,
    slotName: 'default',
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

const internalTool = ref<DrawingTool>(props.tool)
const internalColor = ref(props.color)
const internalSize = ref(props.size)

watch(
  () => props.tool,
  (v) => {
    internalTool.value = v
  }
)
watch(
  () => props.color,
  (v) => {
    internalColor.value = v
  }
)
watch(
  () => props.size,
  (v) => {
    internalSize.value = v
  }
)

const currentOptions = computed(
  (): DrawingOptions => ({
    tool: internalTool.value,
    color: internalColor.value,
    size: internalSize.value
  })
)

const getSnapshot = (): string => {
  const dataUrl = canvasEditorCanvasReference.value?.snapshot() ?? ''
  return JSON.stringify({ front: dataUrl, back: '' })
}

const handleChange = (dataUrl: string): void => {
  emit('change', dataUrl)
}

const handleHistoryChange = (state: { canUndo: boolean; canRedo: boolean }): void => {
  canUndo.value = state.canUndo
  canRedo.value = state.canRedo
}

const handleToolUpdate = (value: DrawingTool): void => {
  internalTool.value = value
  emit('update:tool', value)
}

const handleColorUpdate = (value: string): void => {
  internalColor.value = value
  emit('update:color', value)
}

const handleSizeUpdate = (value: number): void => {
  internalSize.value = value
  emit('update:size', value)
}

const undo = (): Promise<void> | undefined => canvasEditorCanvasReference.value?.undo()
const redo = (): Promise<void> | undefined => canvasEditorCanvasReference.value?.redo()
const clear = (): void => canvasEditorCanvasReference.value?.clear()

defineExpose({
  snapshot: (): string => canvasEditorCanvasReference.value?.snapshot() ?? '',
  restore: (dataUrl: string, options?: { silent?: boolean }): Promise<void> =>
    canvasEditorCanvasReference.value?.restore(dataUrl, options) ?? Promise.resolve()
})

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
  const slot = await storageLoad('localStorage', props.slotName)
  const savedFront = slot ? (JSON.parse(slot.dataUrl) as { front: string }).front : ''
  const imageToLoad = savedFront || props.defaultImage || ''
  if (imageToLoad) {
    await canvasEditorCanvasReference.value?.restore(imageToLoad, { silent: true })
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
      :background-image="backgroundImage"
      @change="handleChange"
      @history-change="handleHistoryChange"
    />
    <CanvasEditorTools
      :tool="internalTool"
      :color="internalColor"
      :size="internalSize"
      :can-undo="canUndo"
      :can-redo="canRedo"
      :slot-name="slotName"
      :get-snapshot="getSnapshot"
      @update:tool="handleToolUpdate"
      @update:color="handleColorUpdate"
      @update:size="handleSizeUpdate"
      @undo="undo"
      @redo="redo"
      @clear="clear"
    />
  </div>
</template>

<style scoped>
.canvas-editor {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
}
</style>
