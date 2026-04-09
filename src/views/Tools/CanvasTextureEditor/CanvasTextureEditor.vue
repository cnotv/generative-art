<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import {
  drawingStroke,
  drawingDot,
  drawingFill,
  drawingClear,
  drawingRestore,
  historyCreate,
  historyPush,
  historyUndo,
  historyRedo,
  historyCanUndo,
  historyCanRedo,
  storageSave,
  storageLoad,
  storageDelete,
  storageList,
  textureBuildCombined,
  textureToDataUrl
} from '@webgamekit/canvas-editor'
import type { DrawingTool, DrawingOptions, StorageBackend } from '@webgamekit/canvas-editor'
import { registerViewConfig, unregisterViewConfig, createReactiveConfig } from '@/stores/viewConfig'

const CANVAS_WIDTH = 512
const CANVAS_HEIGHT = 512
const DEFAULT_COLOR = '#ff6633'
const DEFAULT_SIZE = 20
const STORAGE_KEY_LAST = 'canvas-editor-last'
const TEXTURE_CHANNEL = 'canvas-editor-preview'

const route = useRoute()
const canvasReference = ref<HTMLCanvasElement | null>(null)

const reactiveConfig = createReactiveConfig({
  tool: 'brush' as DrawingTool,
  color: DEFAULT_COLOR,
  size: DEFAULT_SIZE,
  backend: 'localStorage' as StorageBackend
})

const configControls = {
  tool: {
    select: [
      { value: 'brush', label: 'Brush' },
      { value: 'eraser', label: 'Eraser' },
      { value: 'fill', label: 'Fill' }
    ],
    label: 'Tool'
  },
  color: { color: true, label: 'Color' },
  size: { min: 1, max: 80, step: 1, label: 'Brush Size' },
  backend: {
    select: [
      { value: 'localStorage', label: 'Local Storage' },
      { value: 'indexedDB', label: 'IndexedDB' }
    ],
    label: 'Storage Backend'
  }
}

let history = historyCreate()
const canUndo = ref(false)
const canRedo = ref(false)

const slots = ref<string[]>([])
const slotName = ref('default')
const previewDataUrl = ref<string | null>(null)

let isDrawing = false
let lastPoint = { x: 0, y: 0 }

const getContext = (): CanvasRenderingContext2D | null =>
  canvasReference.value?.getContext('2d') ?? null

const currentOptions = computed(
  (): DrawingOptions => ({
    tool: reactiveConfig.value.tool,
    color: reactiveConfig.value.color,
    size: reactiveConfig.value.size
  })
)

const snapshot = (): string => canvasReference.value?.toDataURL() ?? ''

const pushHistory = (): void => {
  history = historyPush(history, snapshot())
  canUndo.value = historyCanUndo(history)
  canRedo.value = historyCanRedo(history)
}

const undo = async (): Promise<void> => {
  const { stack, snapshot: snap } = historyUndo(history)
  history = stack
  canUndo.value = historyCanUndo(history)
  canRedo.value = historyCanRedo(history)
  const ctx = getContext()
  if (!ctx) return
  if (snap) {
    await drawingRestore(ctx, snap)
  } else {
    drawingClear(ctx)
  }
  updatePreview()
}

const redo = async (): Promise<void> => {
  const { stack, snapshot: snap } = historyRedo(history)
  history = stack
  canUndo.value = historyCanUndo(history)
  canRedo.value = historyCanRedo(history)
  const ctx = getContext()
  if (!ctx || !snap) return
  await drawingRestore(ctx, snap)
  updatePreview()
}

const canvasPoint = (event: MouseEvent | Touch): { x: number; y: number } => {
  const rect = canvasReference.value!.getBoundingClientRect()
  const scaleX = CANVAS_WIDTH / rect.width
  const scaleY = CANVAS_HEIGHT / rect.height
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY
  }
}

const onPointerDown = (event: MouseEvent): void => {
  isDrawing = true
  lastPoint = canvasPoint(event)
  const ctx = getContext()
  if (!ctx) return

  if (currentOptions.value.tool === 'fill') {
    pushHistory()
    drawingFill(ctx, lastPoint, currentOptions.value.color)
    updatePreview()
    isDrawing = false
    return
  }

  drawingDot(ctx, lastPoint, currentOptions.value)
  updatePreview()
}

const onPointerMove = (event: MouseEvent): void => {
  if (!isDrawing) return
  const ctx = getContext()
  if (!ctx) return

  const point = canvasPoint(event)
  drawingStroke(ctx, lastPoint, point, currentOptions.value)
  lastPoint = point
  updatePreview()
}

const onPointerUp = (): void => {
  if (!isDrawing) return
  isDrawing = false
  pushHistory()
}

const onTouchStart = (event: TouchEvent): void => {
  event.preventDefault()
  const touch = event.touches[0]
  isDrawing = true
  lastPoint = canvasPoint(touch)
  const ctx = getContext()
  if (!ctx) return

  if (currentOptions.value.tool === 'fill') {
    pushHistory()
    drawingFill(ctx, lastPoint, currentOptions.value.color)
    updatePreview()
    isDrawing = false
    return
  }

  drawingDot(ctx, lastPoint, currentOptions.value)
  updatePreview()
}

const onTouchMove = (event: TouchEvent): void => {
  event.preventDefault()
  if (!isDrawing) return
  const ctx = getContext()
  if (!ctx) return

  const touch = event.touches[0]
  const point = canvasPoint(touch)
  drawingStroke(ctx, lastPoint, point, currentOptions.value)
  lastPoint = point
  updatePreview()
}

const onTouchEnd = (): void => {
  if (!isDrawing) return
  isDrawing = false
  pushHistory()
}

const clear = (): void => {
  const ctx = getContext()
  if (!ctx) return
  pushHistory()
  drawingClear(ctx)
  previewDataUrl.value = null
}

const updatePreview = async (): Promise<void> => {
  const dataUrl = snapshot()
  const combined = await textureBuildCombined(dataUrl, null)
  previewDataUrl.value = textureToDataUrl(combined)
  localStorage.setItem(STORAGE_KEY_LAST, dataUrl)
}

const refreshSlots = async (): Promise<void> => {
  const list = storageList(reactiveConfig.value.backend)
  slots.value = await Promise.resolve(list)
}

const save = async (): Promise<void> => {
  const name = slotName.value.trim() || 'default'
  await storageSave(reactiveConfig.value.backend, name, snapshot())
  await refreshSlots()
}

const load = async (name: string): Promise<void> => {
  const slot = await storageLoad(reactiveConfig.value.backend, name)
  if (!slot) return
  const ctx = getContext()
  if (!ctx) return
  pushHistory()
  await drawingRestore(ctx, slot.dataUrl)
  updatePreview()
}

const deleteSlot = async (name: string): Promise<void> => {
  await storageDelete(reactiveConfig.value.backend, name)
  await refreshSlots()
}

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

const exportDataUrl = (): string => snapshot()

const TEXTURE_CHANNEL_KEY = TEXTURE_CHANNEL

defineExpose({ exportDataUrl, TEXTURE_CHANNEL_KEY })

onMounted(async () => {
  registerViewConfig(route.name as string, reactiveConfig, configControls)
  await refreshSlots()

  const last = localStorage.getItem(STORAGE_KEY_LAST)
  if (last) {
    const ctx = getContext()
    if (ctx) await drawingRestore(ctx, last)
    updatePreview()
  }

  window.addEventListener('keydown', onKeyDown)
})

onUnmounted(() => {
  unregisterViewConfig(route.name as string)
  window.removeEventListener('keydown', onKeyDown)
})
</script>

<template>
  <div class="canvas-texture-editor">
    <div class="canvas-texture-editor__workspace">
      <div class="canvas-texture-editor__canvas-wrapper">
        <canvas
          ref="canvasReference"
          class="canvas-texture-editor__canvas"
          :width="CANVAS_WIDTH"
          :height="CANVAS_HEIGHT"
          @mousedown="onPointerDown"
          @mousemove="onPointerMove"
          @mouseup="onPointerUp"
          @mouseleave="onPointerUp"
          @touchstart.prevent="onTouchStart"
          @touchmove.prevent="onTouchMove"
          @touchend="onTouchEnd"
        />
      </div>

      <div class="canvas-texture-editor__preview-wrapper">
        <p class="canvas-texture-editor__preview-label">Preview (front/back atlas)</p>
        <img
          v-if="previewDataUrl"
          class="canvas-texture-editor__preview"
          :src="previewDataUrl"
          alt="Texture preview"
        />
        <div v-else class="canvas-texture-editor__preview-empty">Draw to see preview</div>
      </div>
    </div>

    <div class="canvas-texture-editor__toolbar">
      <div class="canvas-texture-editor__toolbar-group">
        <button
          class="canvas-texture-editor__btn"
          :class="{ 'canvas-texture-editor__btn--active': reactiveConfig.tool === 'brush' }"
          title="Brush"
          @click="reactiveConfig.tool = 'brush'"
        >
          Brush
        </button>
        <button
          class="canvas-texture-editor__btn"
          :class="{ 'canvas-texture-editor__btn--active': reactiveConfig.tool === 'eraser' }"
          title="Eraser"
          @click="reactiveConfig.tool = 'eraser'"
        >
          Eraser
        </button>
        <button
          class="canvas-texture-editor__btn"
          :class="{ 'canvas-texture-editor__btn--active': reactiveConfig.tool === 'fill' }"
          title="Fill"
          @click="reactiveConfig.tool = 'fill'"
        >
          Fill
        </button>
      </div>

      <div class="canvas-texture-editor__toolbar-group">
        <label class="canvas-texture-editor__label" title="Color">
          Color
          <input
            v-model="reactiveConfig.color"
            type="color"
            class="canvas-texture-editor__color-input"
          />
        </label>
        <label class="canvas-texture-editor__label" title="Brush size">
          Size
          <input
            v-model.number="reactiveConfig.size"
            type="range"
            min="1"
            max="80"
            class="canvas-texture-editor__range"
          />
          <span>{{ reactiveConfig.size }}</span>
        </label>
      </div>

      <div class="canvas-texture-editor__toolbar-group">
        <button
          class="canvas-texture-editor__btn"
          :disabled="!canUndo"
          title="Undo (Ctrl+Z)"
          @click="undo"
        >
          Undo
        </button>
        <button
          class="canvas-texture-editor__btn"
          :disabled="!canRedo"
          title="Redo (Ctrl+Y)"
          @click="redo"
        >
          Redo
        </button>
        <button
          class="canvas-texture-editor__btn canvas-texture-editor__btn--danger"
          title="Clear canvas"
          @click="clear"
        >
          Clear
        </button>
      </div>
    </div>

    <div class="canvas-texture-editor__storage">
      <div class="canvas-texture-editor__storage-header">
        <select
          v-model="reactiveConfig.backend"
          class="canvas-texture-editor__select"
          title="Storage backend"
          @change="refreshSlots"
        >
          <option value="localStorage">Local Storage</option>
          <option value="indexedDB">IndexedDB</option>
        </select>

        <input
          v-model="slotName"
          class="canvas-texture-editor__input"
          placeholder="Slot name"
          title="Save slot name"
        />
        <button class="canvas-texture-editor__btn" title="Save to slot" @click="save">Save</button>
      </div>

      <ul v-if="slots.length > 0" class="canvas-texture-editor__slot-list">
        <li v-for="name in slots" :key="name" class="canvas-texture-editor__slot">
          <span class="canvas-texture-editor__slot-name">{{ name }}</span>
          <button class="canvas-texture-editor__btn" title="Load slot" @click="load(name)">
            Load
          </button>
          <button
            class="canvas-texture-editor__btn canvas-texture-editor__btn--danger"
            title="Delete slot"
            @click="deleteSlot(name)"
          >
            Delete
          </button>
        </li>
      </ul>
      <p v-else class="canvas-texture-editor__empty">No saved slots</p>
    </div>
  </div>
</template>

<style scoped>
.canvas-texture-editor {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
  padding: var(--spacing-4);
  min-height: 100vh;
  background: var(--color-background);
  color: var(--color-foreground);
}

.canvas-texture-editor__workspace {
  display: flex;
  gap: var(--spacing-4);
  align-items: flex-start;
  flex-wrap: wrap;
}

.canvas-texture-editor__canvas-wrapper {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
  cursor: crosshair;
  background-image:
    linear-gradient(45deg, #ccc 25%, transparent 25%),
    linear-gradient(-45deg, #ccc 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #ccc 75%),
    linear-gradient(-45deg, transparent 75%, #ccc 75%);
  background-size: 16px 16px;
  background-position:
    0 0,
    0 8px,
    8px -8px,
    -8px 0;
}

.canvas-texture-editor__canvas {
  display: block;
  max-width: 100%;
  touch-action: none;
}

.canvas-texture-editor__preview-wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.canvas-texture-editor__preview-label {
  font-size: var(--font-size-xs);
  color: var(--color-muted-foreground);
  margin: 0;
}

.canvas-texture-editor__preview {
  max-width: 300px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.canvas-texture-editor__preview-empty {
  width: 300px;
  height: 150px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-xs);
  color: var(--color-muted-foreground);
}

.canvas-texture-editor__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-4);
  align-items: center;
  padding: var(--spacing-3) var(--spacing-4);
  background: var(--color-secondary);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.canvas-texture-editor__toolbar-group {
  display: flex;
  gap: var(--spacing-2);
  align-items: center;
}

.canvas-texture-editor__btn {
  padding: var(--spacing-1-5) var(--spacing-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-background);
  color: var(--color-foreground);
  font-size: var(--font-size-xs);
  cursor: pointer;
  transition: background 0.15s;
}

.canvas-texture-editor__btn:hover:not(:disabled) {
  background: var(--color-accent);
}

.canvas-texture-editor__btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.canvas-texture-editor__btn--active {
  background: var(--color-primary);
  color: var(--color-primary-foreground);
  border-color: var(--color-primary);
}

.canvas-texture-editor__btn--danger {
  border-color: var(--color-destructive);
  color: var(--color-destructive);
}

.canvas-texture-editor__btn--danger:hover:not(:disabled) {
  background: var(--color-destructive);
  color: var(--color-destructive-foreground);
}

.canvas-texture-editor__label {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  font-size: var(--font-size-xs);
  color: var(--color-muted-foreground);
  cursor: pointer;
}

.canvas-texture-editor__color-input {
  width: 2rem;
  height: 1.5rem;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.canvas-texture-editor__range {
  width: 6rem;
  cursor: pointer;
}

.canvas-texture-editor__storage {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
  padding: var(--spacing-4);
  background: var(--color-secondary);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.canvas-texture-editor__storage-header {
  display: flex;
  gap: var(--spacing-2);
  align-items: center;
  flex-wrap: wrap;
}

.canvas-texture-editor__select,
.canvas-texture-editor__input {
  padding: var(--spacing-1-5) var(--spacing-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-background);
  color: var(--color-foreground);
  font-size: var(--font-size-xs);
}

.canvas-texture-editor__slot-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1-5);
}

.canvas-texture-editor__slot {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
}

.canvas-texture-editor__slot-name {
  flex: 1;
  font-size: var(--font-size-xs);
}

.canvas-texture-editor__empty {
  font-size: var(--font-size-xs);
  color: var(--color-muted-foreground);
  margin: 0;
}
</style>
