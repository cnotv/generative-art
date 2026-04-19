<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import CanvasEditorCanvas from './CanvasEditorCanvas.vue'
import CanvasEditorTools from './CanvasEditorTools.vue'
import { storageLoad } from '@webgamekit/canvas-editor'
import type { DrawingTool, DrawingOptions, StrokeEvent } from '@webgamekit/canvas-editor'
import type { CanvasEditorToolButton } from './types'

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
    interactive?: boolean
    disableStorage?: boolean
    showTools?: boolean
    visibleTools?: readonly CanvasEditorToolButton[]
  }>(),
  {
    tool: 'brush',
    color: '#000000',
    size: 10,
    slotName: 'default',
    canvasWidth: 512,
    canvasHeight: 512,
    interactive: true,
    disableStorage: false,
    showTools: true
  }
)

const emit = defineEmits<{
  'update:tool': [value: DrawingTool]
  'update:color': [value: string]
  'update:size': [value: number]
  change: [dataUrl: string]
  stroke: [event: StrokeEvent]
  clear: []
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

const handleStroke = (event: StrokeEvent): void => {
  emit('stroke', event)
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
const clear = (): void => {
  canvasEditorCanvasReference.value?.clear()
  emit('clear')
}

defineExpose({
  snapshot: (): string => canvasEditorCanvasReference.value?.snapshot() ?? '',
  restore: (dataUrl: string, options?: { silent?: boolean }): Promise<void> =>
    canvasEditorCanvasReference.value?.restore(dataUrl, options) ?? Promise.resolve(),
  renderSegment: (event: StrokeEvent): void =>
    canvasEditorCanvasReference.value?.renderSegment(event),
  silentClear: (): void => canvasEditorCanvasReference.value?.silentClear()
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
  if (!props.disableStorage) {
    const slot = await storageLoad('localStorage', props.slotName)
    const savedFront = slot ? (JSON.parse(slot.dataUrl) as { front: string }).front : ''
    const imageToLoad = savedFront || props.defaultImage || ''
    if (imageToLoad) {
      await canvasEditorCanvasReference.value?.restore(imageToLoad, { silent: true })
    }
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
      :interactive="interactive"
      @change="handleChange"
      @history-change="handleHistoryChange"
      @stroke="handleStroke"
    />
    <CanvasEditorTools
      v-if="showTools"
      :tool="internalTool"
      :color="internalColor"
      :size="internalSize"
      :can-undo="canUndo"
      :can-redo="canRedo"
      :slot-name="slotName"
      :get-snapshot="getSnapshot"
      :visible-tools="visibleTools"
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
  flex-grow: 1;
  margin: 0.8em;
}
</style>
